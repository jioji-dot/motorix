import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/paged_result.dart';
import '../../models/vehicle.dart';
import '../../providers/auth_provider.dart';
import '../../providers/vehicles_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Listado de vehículos con búsqueda y paginación.
class VehiclesListScreen extends StatefulWidget {
  const VehiclesListScreen({super.key});

  @override
  State<VehiclesListScreen> createState() => _VehiclesListScreenState();
}

class _VehiclesListScreenState extends State<VehiclesListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<VehiclesProvider>().load(page: 1, search: '');
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String texto) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) context.read<VehiclesProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _openForm() async {
    final Object? creado = await Navigator.of(context).pushNamed(AppRoutes.vehicleForm);
    if (creado == true && mounted) context.read<VehiclesProvider>().load(page: 1);
  }

  void _openDetail(int id) =>
      Navigator.of(context).pushNamed(AppRoutes.vehicleDetail, arguments: id);

  @override
  Widget build(BuildContext context) {
    final VehiclesProvider vehicles = context.watch<VehiclesProvider>();
    final bool canWrite = context.watch<AuthProvider>().role?.canManageRecords ?? false;
    final PagedResult<Vehicle>? result = vehicles.result;

    return AppShell(
      currentRoute: AppRoutes.vehicles,
      title: 'Vehículos',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 360),
                      child: TextField(
                        controller: _searchController,
                        onChanged: _onSearchChanged,
                        decoration: const InputDecoration(
                          hintText: 'Buscar por placa, marca, modelo o propietario',
                          prefixIcon: Icon(LucideIcons.search, size: 18),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                if (canWrite)
                  FilledButton.icon(
                    onPressed: _openForm,
                    icon: const Icon(LucideIcons.plus, size: 18),
                    label: const Text('Nuevo vehículo'),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: Panel(child: _buildBody(vehicles, result, canWrite))),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(VehiclesProvider vehicles, PagedResult<Vehicle>? result, bool canWrite) {
    if (vehicles.error != null) {
      return ErrorStateView(message: vehicles.error!, onRetry: () => vehicles.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      final bool buscando = vehicles.search.isNotEmpty;
      return EmptyStateView(
        message: buscando
            ? 'No se encontraron vehículos con esa búsqueda.'
            : 'Aún no hay vehículos registrados.',
        actionLabel: (!buscando && canWrite) ? 'Registrar el primer vehículo' : null,
        onAction: (!buscando && canWrite) ? _openForm : null,
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Placa')),
                  DataColumn(label: Text('Vehículo')),
                  DataColumn(label: Text('Año')),
                  DataColumn(label: Text('Propietario')),
                  DataColumn(label: Text('Kilometraje')),
                  DataColumn(label: Text('Acciones')),
                ],
                rows: <DataRow>[
                  for (final Vehicle v in result.items)
                    DataRow(
                      onSelectChanged: (_) => _openDetail(v.id),
                      cells: <DataCell>[
                        DataCell(Text(v.licensePlate)),
                        DataCell(Text(v.title, overflow: TextOverflow.ellipsis)),
                        DataCell(Text('${v.year}')),
                        DataCell(Text(Format.orDash(v.ownerName), overflow: TextOverflow.ellipsis)),
                        DataCell(Text(Format.mileage(v.currentMileage))),
                        DataCell(
                          IconButton(
                            tooltip: 'Ver detalle',
                            icon: const Icon(LucideIcons.eye, size: 18),
                            onPressed: () => _openDetail(v.id),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              if (vehicles.loading)
                const Positioned(
                  top: AppSpacing.sm,
                  right: AppSpacing.sm,
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
            ],
          ),
        ),
        PaginationBar(result: result, onPage: (int p) => vehicles.load(page: p)),
      ],
    );
  }
}
