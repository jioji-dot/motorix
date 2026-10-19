import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/dashboard.dart';
import '../providers/dashboard_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'home_screen.dart';

const _estadosDeOrden = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO', 'ENTREGADO', 'CANCELADA'];

/// Panel de control del administrador: cifras reales de órdenes, citas, mantenimientos, inventario y cobros,
/// calculadas por el servidor al abrirlo. Cada tarjeta lleva al módulo de origen.
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

  void _ir(String seccion) => HomeNavigation.maybeOf(context)?.goTo(seccion);

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DashboardProvider>();
    final texto = Theme.of(context).textTheme;

    if (provider.loading && provider.data == null) return const LoadingState(message: 'Cargando el panel...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);
    final d = provider.data;
    if (d == null) return const LoadingState(message: 'Cargando el panel...');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Actualizado ${formatDateTime(d.generatedAt)}', style: texto.bodySmall)),
              IconButton(
                key: const Key('boton-recargar-panel'),
                tooltip: 'Actualizar',
                onPressed: provider.loading ? null : provider.load,
                icon: const Icon(LucideIcons.refreshCw, size: 18),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          LayoutBuilder(
            builder: (context, restricciones) {
              // Dos columnas en ventanas anchas y una en las angostas.
              final dosColumnas = restricciones.maxWidth >= 760;
              final ancho = dosColumnas ? (restricciones.maxWidth - AppSpacing.lg) / 2 : restricciones.maxWidth;
              final tarjetas = [
                _Tarjeta(key: const Key('tarjeta-ordenes'), titulo: 'Órdenes de servicio', icono: LucideIcons.clipboardList, onTap: () => _ir('Órdenes de servicio'), child: _Ordenes(d: d)),
                _Tarjeta(key: const Key('tarjeta-cobros'), titulo: 'Cobros', icono: LucideIcons.wallet, onTap: () => _ir('Órdenes de servicio'), child: _Cobros(d: d)),
                _Tarjeta(key: const Key('tarjeta-citas'), titulo: 'Citas', icono: LucideIcons.calendarDays, onTap: () => _ir('Citas'), child: _Citas(d: d)),
                _Tarjeta(key: const Key('tarjeta-mantenimientos'), titulo: 'Mantenimientos', icono: LucideIcons.wrench, onTap: () => _ir('Mantenimientos'), child: _Mantenimientos(d: d)),
                _Tarjeta(key: const Key('tarjeta-inventario'), titulo: 'Inventario', icono: LucideIcons.package, onTap: () => _ir('Inventario'), child: _Inventario(d: d)),
              ];
              return Wrap(
                spacing: AppSpacing.lg,
                runSpacing: AppSpacing.lg,
                children: [for (final t in tarjetas) SizedBox(width: ancho, child: t)],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _Tarjeta extends StatelessWidget {
  const _Tarjeta({super.key, required this.titulo, required this.icono, required this.child, required this.onTap});

  final String titulo;
  final IconData icono;
  final Widget child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(icono, size: 18, color: AppColors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(titulo, style: texto.titleMedium, overflow: TextOverflow.ellipsis)),
                  const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textSecondary),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

/// Cifra grande con su etiqueta.
class _Dato extends StatelessWidget {
  const _Dato({required this.etiqueta, required this.valor, this.color});

  final String etiqueta;
  final String valor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(valor, style: texto.headlineSmall?.copyWith(color: color)),
        Text(etiqueta, style: texto.bodySmall),
      ],
    );
  }
}

class _Ordenes extends StatelessWidget {
  const _Ordenes({required this.d});

  final Dashboard d;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.sm,
          children: [
            for (final estado in _estadosDeOrden)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  StatusChip.order(estado),
                  const SizedBox(width: AppSpacing.xs),
                  Text('${d.ordersByStatus[estado] ?? 0}', key: Key('ordenes-$estado'), style: texto.titleSmall),
                ],
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          key: const Key('ordenes-por-cobrar'),
          d.ordersWithBalance == 0
              ? 'Ninguna orden con saldo por cobrar'
              : '${d.ordersWithBalance} orden${d.ordersWithBalance == 1 ? '' : 'es'} con saldo por cobrar · ${formatMoney(d.balanceAmount)}',
          style: texto.bodyMedium,
        ),
      ],
    );
  }
}

class _Cobros extends StatelessWidget {
  const _Cobros({required this.d});

  final Dashboard d;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xl,
      runSpacing: AppSpacing.md,
      children: [
        _Dato(etiqueta: 'Cobrado hoy', valor: formatMoney(d.collectedToday)),
        _Dato(etiqueta: 'Cobrado en el mes', valor: formatMoney(d.collectedMonth)),
        _Dato(etiqueta: 'Por cobrar', valor: formatMoney(d.pendingToCollect), color: double.parse(d.pendingToCollect) > 0 ? AppColors.warning : null),
      ],
    );
  }
}

class _Citas extends StatelessWidget {
  const _Citas({required this.d});

  final Dashboard d;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.xl,
          runSpacing: AppSpacing.md,
          children: [
            _Dato(etiqueta: 'Citas de hoy', valor: '${d.appointmentsToday}'),
            _Dato(etiqueta: 'Próximos 7 días', valor: '${d.appointmentsUpcoming}'),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        if (d.nextAppointments.isEmpty)
          Text('Sin citas pendientes en los próximos días', style: texto.bodyMedium?.copyWith(color: AppColors.textSecondary))
        else
          for (final c in d.nextAppointments)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Text('${formatDateTime(c.scheduledAt)} · ${c.clientName} · ${c.licensePlate}', style: texto.bodyMedium, overflow: TextOverflow.ellipsis),
            ),
      ],
    );
  }
}

class _Mantenimientos extends StatelessWidget {
  const _Mantenimientos({required this.d});

  final Dashboard d;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xl,
      runSpacing: AppSpacing.md,
      children: [
        _Dato(etiqueta: 'Vencidos', valor: '${d.maintenanceOverdue}', color: d.maintenanceOverdue > 0 ? AppColors.danger : null),
        _Dato(etiqueta: 'Próximos', valor: '${d.maintenanceSoon}', color: d.maintenanceSoon > 0 ? AppColors.warning : null),
      ],
    );
  }
}

class _Inventario extends StatelessWidget {
  const _Inventario({required this.d});

  final Dashboard d;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.xl,
          runSpacing: AppSpacing.md,
          children: [
            _Dato(etiqueta: 'Stock bajo', valor: '${d.stockLow}', color: d.stockLow > 0 ? AppColors.warning : null),
            _Dato(etiqueta: 'Agotadas', valor: '${d.stockOut}', color: d.stockOut > 0 ? AppColors.danger : null),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        if (d.mostUrgentParts.isEmpty)
          Text('Todo el stock está en orden', style: texto.bodyMedium?.copyWith(color: AppColors.textSecondary))
        else
          for (final p in d.mostUrgentParts)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(child: Text('${p.name} (${p.code})', style: texto.bodyMedium, overflow: TextOverflow.ellipsis)),
                  const SizedBox(width: AppSpacing.md),
                  Text('${p.stock} de ${p.minimumStock}', style: texto.bodySmall),
                ],
              ),
            ),
      ],
    );
  }
}
