import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/maintenance.dart';
import '../../models/paged_result.dart';
import '../../providers/maintenance_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/status_chip.dart';

/// Mantenimientos próximos y vencidos para avisar a los clientes (recepción y administración).
/// Muestra el nombre y el teléfono del cliente; el sistema no envía mensajes.
class MaintenanceListScreen extends StatefulWidget {
  const MaintenanceListScreen({super.key});

  @override
  State<MaintenanceListScreen> createState() => _MaintenanceListScreenState();
}

class _MaintenanceListScreenState extends State<MaintenanceListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<MaintenanceProvider>().load(
              page: 1,
              filter: MaintenanceFilter.alert,
              search: '',
            );
      }
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
      if (mounted) context.read<MaintenanceProvider>().load(page: 1, search: texto);
    });
  }

  @override
  Widget build(BuildContext context) {
    final MaintenanceProvider provider = context.watch<MaintenanceProvider>();
    final PagedResult<Maintenance>? result = provider.result;

    return AppShell(
      currentRoute: AppRoutes.maintenance,
      title: 'Mantenimientos',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              children: <Widget>[
                SizedBox(
                  width: 320,
                  child: TextField(
                    controller: _searchController,
                    onChanged: _onSearchChanged,
                    decoration: const InputDecoration(
                      hintText: 'Buscar por cliente o placa',
                      prefixIcon: Icon(LucideIcons.search, size: 18),
                    ),
                  ),
                ),
                SizedBox(
                  width: 240,
                  child: DropdownButtonFormField<MaintenanceFilter>(
                    key: ValueKey<MaintenanceFilter>(provider.filter),
                    initialValue: provider.filter,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Mostrar'),
                    items: <DropdownMenuItem<MaintenanceFilter>>[
                      for (final MaintenanceFilter f in MaintenanceFilter.values)
                        DropdownMenuItem<MaintenanceFilter>(value: f, child: Text(f.label)),
                    ],
                    onChanged: (MaintenanceFilter? f) {
                      if (f != null) provider.load(page: 1, filter: f);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Se avisan los mantenimientos que vencen en ${provider.warningDays} días o '
              '${Format.mileage(provider.warningKm)}. Contacta al cliente por tus propios medios.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: Panel(child: _buildBody(provider, result))),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(MaintenanceProvider provider, PagedResult<Maintenance>? result) {
    if (provider.error != null) {
      return ErrorStateView(message: provider.error!, onRetry: () => provider.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      final bool filtrado = provider.hasSearch || provider.filter != MaintenanceFilter.alert;
      return EmptyStateView(
        message: filtrado
            ? 'No se encontraron mantenimientos con esos filtros.'
            : 'No hay mantenimientos por avisar.',
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Cliente')),
                  DataColumn(label: Text('Teléfono')),
                  DataColumn(label: Text('Vehículo')),
                  DataColumn(label: Text('Mantenimiento')),
                  DataColumn(label: Text('Objetivo')),
                  DataColumn(label: Text('Restante')),
                  DataColumn(label: Text('Estado')),
                ],
                rows: <DataRow>[
                  for (final Maintenance m in result.items)
                    DataRow(
                      onSelectChanged: (_) => Navigator.of(context)
                          .pushNamed(AppRoutes.vehicleDetail, arguments: m.vehicleId),
                      cells: <DataCell>[
                        DataCell(Text(m.clientName, overflow: TextOverflow.ellipsis)),
                        DataCell(SelectableText(Format.orDash(m.clientPhone))),
                        DataCell(Text('${m.vehiclePlate} · ${m.vehicleTitle}')),
                        DataCell(Text(m.description, overflow: TextOverflow.ellipsis)),
                        DataCell(Text(_objetivo(m))),
                        DataCell(Text(_restante(m))),
                        DataCell(_estado(m)),
                      ],
                    ),
                ],
              ),
              if (provider.loading)
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
        PaginationBar(result: result, onPage: (int p) => provider.load(page: p)),
      ],
    );
  }

  static String _objetivo(Maintenance m) {
    final List<String> partes = <String>[
      if (m.nextDate != null) Format.dateOnly(m.nextDate),
      if (m.nextMileage != null) Format.mileage(m.nextMileage!),
    ];
    return partes.join(' · ');
  }

  static String _restante(Maintenance m) {
    if (!m.isPending) return '—';
    final List<String> partes = <String>[];
    if (m.daysRemaining != null) {
      final int d = m.daysRemaining!;
      partes.add(d < 0 ? 'hace ${-d} d' : d == 0 ? 'hoy' : 'en $d d');
    }
    if (m.kmRemaining != null) {
      final int k = m.kmRemaining!;
      partes.add(k < 0 ? 'excedido ${Format.mileage(-k)}' : 'faltan ${Format.mileage(k)}');
    }
    return partes.isEmpty ? '—' : partes.join(' · ');
  }

  static Widget _estado(Maintenance m) {
    final MaintenanceClassification? clase = m.classification;
    if (clase != null) return StatusChip(label: clase.label, color: clase.color);
    return StatusChip(
      label: m.status.label,
      color: m.status == MaintenanceStatus.done ? AppColors.success : AppColors.textSecondary,
    );
  }
}
