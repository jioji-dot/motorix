import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../providers/vehicles_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import 'vehicle_detail_screen.dart';
import 'vehicle_form_screen.dart';

/// Listado de vehículos con búsqueda por placas, marca, modelo o propietario.
class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<VehiclesProvider>().load(page: 1);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String valor) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) context.read<VehiclesProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm({Vehicle? vehicle}) async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => VehicleFormScreen(vehicle: vehicle)),
    );
    if (guardado == true && mounted) context.read<VehiclesProvider>().load();
  }

  Future<void> _openDetail(Vehicle vehicle) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => VehicleDetailScreen(vehicleId: vehicle.id)),
    );
    if (mounted) context.read<VehiclesProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<VehiclesProvider>();
    final puedeEscribir = context.select<AuthProvider, bool>((a) => a.canManageRecords);

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('campo-busqueda'),
                  onChanged: _onSearchChanged,
                  decoration: const InputDecoration(
                    hintText: 'Buscar por placas, marca, modelo o propietario',
                    prefixIcon: Icon(LucideIcons.search, size: 18),
                  ),
                ),
              ),
              if (puedeEscribir) ...[
                const SizedBox(width: AppSpacing.md),
                FilledButton(
                  onPressed: () => _openForm(),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.plus, size: 18),
                      SizedBox(width: AppSpacing.sm),
                      Text('Registrar vehículo'),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: _buildBody(provider, puedeEscribir),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(VehiclesProvider provider, bool puedeEscribir) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando vehículos...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty;
      return EmptyState(
        icon: LucideIcons.car,
        title: filtrando ? 'No se encontraron vehículos' : 'Aún no hay vehículos',
        message: filtrando
            ? 'Prueba con otras placas, marca, modelo o propietario.'
            : 'Los vehículos que registres aparecerán aquí.',
        actionLabel: (!filtrando && puedeEscribir) ? 'Registrar vehículo' : null,
        onAction: (!filtrando && puedeEscribir) ? () => _openForm() : null,
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 780,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Placas'), size: ColumnSize.S),
              DataColumn2(label: Text('Vehículo'), size: ColumnSize.L),
              DataColumn2(label: Text('Propietario'), size: ColumnSize.L),
              DataColumn2(label: Text('Kilometraje'), size: ColumnSize.M),
              DataColumn2(label: Text('Acciones'), fixedWidth: 110),
            ],
            rows: [
              for (final vehiculo in provider.items)
                DataRow2(
                  onTap: () => _openDetail(vehiculo),
                  cells: [
                    DataCell(Text(vehiculo.licensePlate)),
                    DataCell(Text(vehiculo.title, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(vehiculo.clientName ?? '—', overflow: TextOverflow.ellipsis)),
                    DataCell(Text(formatMileage(vehiculo.currentMileage))),
                    DataCell(Row(
                      children: [
                        IconButton(
                          tooltip: 'Ver detalle',
                          onPressed: () => _openDetail(vehiculo),
                          icon: const Icon(LucideIcons.eye, size: 18),
                        ),
                        if (puedeEscribir)
                          IconButton(
                            tooltip: 'Editar',
                            onPressed: () => _openForm(vehicle: vehiculo),
                            icon: const Icon(LucideIcons.pencil, size: 18),
                          ),
                      ],
                    )),
                  ],
                ),
            ],
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
          child: Row(
            children: [
              Text('${provider.total} vehículo${provider.total == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.bodySmall),
              const Spacer(),
              IconButton(
                tooltip: 'Página anterior',
                onPressed: provider.page > 1 ? () => provider.load(page: provider.page - 1) : null,
                icon: const Icon(LucideIcons.chevronLeft, size: 18),
              ),
              Text('${provider.page} de ${provider.totalPages}'),
              IconButton(
                tooltip: 'Página siguiente',
                onPressed:
                    provider.page < provider.totalPages ? () => provider.load(page: provider.page + 1) : null,
                icon: const Icon(LucideIcons.chevronRight, size: 18),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
