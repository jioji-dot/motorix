import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/dashboard.dart';
import '../../models/part.dart';
import '../../providers/dashboard_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/dashboard_tile.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/status_chip.dart';

/// Panel de control del administrador: situación actual del taller en una sola pantalla.
/// Cada indicador abre su módulo. No muestra históricos ni gráficas.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<DashboardProvider>().load();
    });
  }

  /// Abre el módulo del indicador (reemplaza la pantalla, igual que el menú lateral).
  void _open(String ruta, {Object? arguments}) =>
      Navigator.of(context).pushReplacementNamed(ruta, arguments: arguments);

  @override
  Widget build(BuildContext context) {
    final DashboardProvider provider = context.watch<DashboardProvider>();
    final Dashboard? datos = provider.data;

    Widget cuerpo;
    if (datos == null && provider.error == null) {
      cuerpo = const LoadingView();
    } else if (datos == null) {
      cuerpo = ErrorStateView(message: provider.error!, onRetry: provider.load);
    } else {
      cuerpo = _buildContent(provider, datos);
    }

    return AppShell(currentRoute: AppRoutes.dashboard, title: 'Panel de control', child: cuerpo);
  }

  Widget _buildContent(DashboardProvider provider, Dashboard d) {
    final TextTheme text = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  d.generatedAt == null
                      ? 'Situación actual del taller'
                      : 'Actualizado: ${Format.instant(d.generatedAt)}',
                  style: text.bodySmall,
                ),
              ),
              OutlinedButton.icon(
                onPressed: provider.loading ? null : provider.load,
                icon: provider.loading
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(LucideIcons.refreshCw, size: 18),
                label: const Text('Actualizar'),
              ),
            ],
          ),
          if (provider.error != null) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            Text(
              '${provider.error} Se muestran los últimos datos cargados.',
              style: text.bodySmall?.copyWith(color: AppColors.danger),
            ),
          ],
          _section('Órdenes', <Widget>[
            DashboardTile(
              title: 'Recibidas',
              value: '${d.orders.received}',
              onTap: () => _open(AppRoutes.orders),
            ),
            DashboardTile(
              title: 'En diagnóstico',
              value: '${d.orders.diagnosis}',
              onTap: () => _open(AppRoutes.orders),
            ),
            DashboardTile(
              title: 'En reparación',
              value: '${d.orders.inRepair}',
              onTap: () => _open(AppRoutes.orders),
            ),
            DashboardTile(
              title: 'Esperando refacción',
              value: '${d.orders.waitingPart}',
              color: d.orders.waitingPart > 0 ? AppColors.warning : null,
              onTap: () => _open(AppRoutes.orders),
            ),
            DashboardTile(
              title: 'Terminadas sin entregar',
              value: '${d.orders.finishedNotDelivered}',
              onTap: () => _open(AppRoutes.orders),
            ),
            DashboardTile(
              title: 'Entregadas hoy',
              value: '${d.orders.deliveredToday}',
              onTap: () => _open(AppRoutes.orders),
            ),
          ]),
          _section('Citas', <Widget>[
            DashboardTile(
              title: 'Citas de hoy',
              value: '${d.appointments.today}',
              onTap: () => _open(AppRoutes.appointments),
            ),
            DashboardTile(
              title: 'Próximos 7 días',
              value: '${d.appointments.next7Days}',
              onTap: () => _open(AppRoutes.appointments),
            ),
            _nextAppointment(d.appointments.next),
          ]),
          _section('Mantenimientos', <Widget>[
            DashboardTile(
              title: 'Vencidos',
              value: '${d.maintenance.overdue}',
              color: d.maintenance.overdue > 0 ? AppColors.danger : null,
              actionLabel: 'Ver avisos',
              onTap: () => _open(AppRoutes.maintenance),
            ),
            DashboardTile(
              title: 'Próximos',
              value: '${d.maintenance.upcoming}',
              color: d.maintenance.upcoming > 0 ? AppColors.warning : null,
              detail: 'En ${d.maintenance.warningDays} días o '
                  '${Format.mileage(d.maintenance.warningKm)}',
              onTap: () => _open(AppRoutes.maintenance),
            ),
          ]),
          _section('Inventario', <Widget>[
            DashboardTile(
              title: 'Stock bajo',
              value: '${d.inventory.low}',
              color: d.inventory.low > 0 ? AppColors.warning : null,
              onTap: () => _open(AppRoutes.inventory, arguments: AlertFilter.low),
            ),
            DashboardTile(
              title: 'Agotadas',
              value: '${d.inventory.out}',
              color: d.inventory.out > 0 ? AppColors.danger : null,
              onTap: () => _open(AppRoutes.inventory, arguments: AlertFilter.out),
            ),
          ]),
          const SizedBox(height: AppSpacing.md),
          _criticalParts(d.inventory.critical),
          _section('Pagos', <Widget>[
            DashboardTile(
              title: 'Cobrado hoy',
              value: Format.money(d.payments.collectedToday),
              color: d.payments.collectedToday > 0 ? AppColors.success : null,
              onTap: () => _open(AppRoutes.payments),
            ),
            DashboardTile(
              title: 'Saldo pendiente',
              value: Format.money(d.payments.pendingBalance),
              color: d.payments.pendingBalance > 0 ? AppColors.warning : null,
              onTap: () => _open(AppRoutes.orders),
            ),
            DashboardTile(
              title: 'Órdenes por cobrar',
              value: '${d.payments.ordersToCollect}',
              onTap: () => _open(AppRoutes.orders),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _nextAppointment(DashboardNextAppointment? siguiente) {
    if (siguiente == null) {
      return DashboardTile(
        title: 'Siguiente cita',
        value: '—',
        emptyMessage: 'No hay citas próximas.',
        onTap: () => _open(AppRoutes.appointments),
      );
    }
    return DashboardTile(
      title: 'Siguiente cita',
      value: Format.dateTime(siguiente.scheduledAt),
      detail: '${siguiente.clientName} · ${siguiente.vehiclePlate}\n${siguiente.reason}',
      onTap: () => _open(AppRoutes.appointments),
    );
  }

  Widget _criticalParts(List<DashboardCriticalPart> partes) {
    final TextTheme text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('Refacciones críticas', style: text.titleSmall),
        const SizedBox(height: AppSpacing.sm),
        Panel(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: partes.isEmpty
              ? Text('No hay refacciones con stock bajo o agotadas.', style: text.bodySmall)
              : Column(
                  children: <Widget>[
                    for (final DashboardCriticalPart p in partes)
                      InkWell(
                        onTap: () => Navigator.of(context).pushNamed(AppRoutes.inventoryDetail, arguments: p.id),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                          child: Row(
                            children: <Widget>[
                              Expanded(
                                child: Text('${p.name} (${p.code})', overflow: TextOverflow.ellipsis),
                              ),
                              Text('${p.stock} de ${p.minimumStock}', style: text.bodySmall),
                              const SizedBox(width: AppSpacing.md),
                              StatusChip(label: p.stockStatus.label, color: p.stockStatus.color),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  /// Sección con título y tarjetas que se acomodan según el ancho disponible.
  Widget _section(String titulo, List<Widget> tarjetas) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const SizedBox(height: AppSpacing.xl),
        Text(titulo, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (BuildContext context, BoxConstraints c) {
            const double minimo = 200;
            final int columnas = (c.maxWidth / (minimo + AppSpacing.md)).floor().clamp(1, tarjetas.length);
            final double ancho = (c.maxWidth - AppSpacing.md * (columnas - 1)) / columnas;
            return Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              children: <Widget>[for (final Widget t in tarjetas) SizedBox(width: ancho, child: t)],
            );
          },
        ),
      ],
    );
  }
}
