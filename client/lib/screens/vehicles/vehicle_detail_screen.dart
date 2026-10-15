import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/history_entry.dart';
import '../../models/paged_result.dart';
import '../../models/vehicle.dart';
import '../../providers/auth_provider.dart';
import '../../providers/maintenance_provider.dart';
import '../../providers/vehicles_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/history_card.dart';
import '../../widgets/maintenance_panel.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import 'vehicle_form_screen.dart';

/// Detalle de un vehículo con su propietario.
class VehicleDetailScreen extends StatefulWidget {
  const VehicleDetailScreen({super.key, required this.vehicleId});

  final int vehicleId;

  @override
  State<VehicleDetailScreen> createState() => _VehicleDetailScreenState();
}

class _VehicleDetailScreenState extends State<VehicleDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final VehiclesProvider provider = context.read<VehiclesProvider>();
      provider.loadDetail(widget.vehicleId);
      provider.loadHistory(widget.vehicleId);
      context.read<MaintenanceProvider>().loadForVehicle(widget.vehicleId);
    });
  }

  Future<void> _edit(Vehicle vehicle) async {
    final Object? guardado = await Navigator.of(context).pushNamed(
      AppRoutes.vehicleForm,
      arguments: VehicleFormArgs(vehicle: vehicle),
    );
    if (guardado == true && mounted) {
      context.read<VehiclesProvider>().loadDetail(widget.vehicleId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final VehiclesProvider provider = context.watch<VehiclesProvider>();
    final bool canWrite = context.watch<AuthProvider>().role?.canManageRecords ?? false;
    final Vehicle? vehicle = provider.detail;

    Widget body;
    if (provider.detailLoading || (vehicle == null && provider.detailError == null)) {
      body = const LoadingView();
    } else if (vehicle == null) {
      body = ErrorStateView(
        message: provider.detailError ?? 'No se pudo cargar el vehículo.',
        onRetry: () => provider.loadDetail(widget.vehicleId),
      );
    } else {
      body = _Content(
        vehicle: vehicle,
        canWrite: canWrite,
        onEdit: () => _edit(vehicle),
        mantenimiento: MaintenancePanel(vehicleId: widget.vehicleId),
        historial: _HistoryPanel(
          provider: provider,
          onPage: (int p) => provider.loadHistory(widget.vehicleId, page: p),
          onRetry: () => provider.loadHistory(widget.vehicleId),
        ),
      );
    }

    return AppShell(
      currentRoute: AppRoutes.vehicles,
      title: 'Detalle del vehículo',
      child: body,
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({
    required this.vehicle,
    required this.canWrite,
    required this.onEdit,
    required this.mantenimiento,
    required this.historial,
  });

  final Vehicle vehicle;
  final bool canWrite;
  final VoidCallback onEdit;
  final Widget mantenimiento;
  final Widget historial;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              IconButton(
                tooltip: 'Volver',
                icon: const Icon(LucideIcons.arrowLeft, size: 20),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text('${vehicle.title} · ${vehicle.licensePlate}', style: text.headlineMedium),
              ),
              if (canWrite)
                OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(LucideIcons.pencil, size: 18),
                  label: const Text('Editar'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          Panel(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              children: <Widget>[
                DetailRow(label: 'Marca', value: vehicle.brand),
                DetailRow(label: 'Modelo', value: vehicle.model),
                DetailRow(label: 'Año', value: '${vehicle.year}'),
                DetailRow(label: 'Placa', value: vehicle.licensePlate),
                DetailRow(label: 'Número de identificación', value: Format.orDash(vehicle.vin)),
                DetailRow(label: 'Color', value: Format.orDash(vehicle.color)),
                DetailRow(label: 'Kilometraje actual', value: Format.mileage(vehicle.currentMileage)),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Propietario', style: text.titleMedium),
          const SizedBox(height: AppSpacing.md),
          Panel(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      DetailRow(label: 'Nombre', value: Format.orDash(vehicle.ownerName)),
                      DetailRow(label: 'Teléfono', value: Format.orDash(vehicle.ownerPhone)),
                    ],
                  ),
                ),
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pushNamed(
                    AppRoutes.clientDetail,
                    arguments: vehicle.clientId,
                  ),
                  child: const Text('Ver cliente'),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Mantenimiento', style: text.titleMedium),
          const SizedBox(height: AppSpacing.md),
          mantenimiento,
          const SizedBox(height: AppSpacing.xl),
          Text('Historial de servicios', style: text.titleMedium),
          const SizedBox(height: AppSpacing.md),
          historial,
        ],
      ),
    );
  }
}

/// Panel con el historial de servicios del vehículo: tarjetas de solo lectura y paginación.
class _HistoryPanel extends StatelessWidget {
  const _HistoryPanel({required this.provider, required this.onPage, required this.onRetry});

  final VehiclesProvider provider;
  final ValueChanged<int> onPage;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final PagedResult<HistoryEntry>? historial = provider.history;

    if (provider.historyError != null) {
      return Panel(
        child: SizedBox(
          height: 160,
          child: ErrorStateView(message: provider.historyError!, onRetry: onRetry),
        ),
      );
    }
    if (historial == null) {
      return const Panel(child: SizedBox(height: 120, child: LoadingView()));
    }
    if (historial.items.isEmpty) {
      return const Panel(
        child: SizedBox(
          height: 120,
          child: EmptyStateView(message: 'Este vehículo aún no tiene servicios registrados.'),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (final HistoryEntry e in historial.items) ...<Widget>[
          HistoryCard(
            entry: e,
            onOpenOrder: () =>
                Navigator.of(context).pushNamed(AppRoutes.orderDetail, arguments: e.orderId),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        Panel(child: PaginationBar(result: historial, onPage: onPage)),
      ],
    );
  }
}
