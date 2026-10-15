import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/paged_result.dart';
import '../../models/part.dart';
import '../../providers/inventory_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stock_chip.dart';

/// Inventario de refacciones con búsqueda, filtro de activas y paginación (solo ADMIN).
class InventoryListScreen extends StatefulWidget {
  const InventoryListScreen({super.key, this.initialAlert});

  /// Filtro de alerta con el que se abre la lista (por ejemplo desde el panel de control).
  final AlertFilter? initialAlert;

  @override
  State<InventoryListScreen> createState() => _InventoryListScreenState();
}

class _InventoryListScreenState extends State<InventoryListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final InventoryProvider inventory = context.read<InventoryProvider>();
      inventory.load(
        page: 1,
        search: '',
        clearActive: true,
        alert: widget.initialAlert,
        clearAlert: widget.initialAlert == null,
      );
      inventory.refreshAlerts();
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
      if (mounted) context.read<InventoryProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _openForm([Part? part]) async {
    final Object? guardado = await Navigator.of(context).pushNamed(
      AppRoutes.inventoryForm,
      arguments: part,
    );
    if (guardado == true && mounted) context.read<InventoryProvider>().load(page: 1);
  }

  Future<void> _openDetail(Part part) async {
    await Navigator.of(context).pushNamed(AppRoutes.inventoryDetail, arguments: part.id);
    if (mounted) {
      final InventoryProvider inventory = context.read<InventoryProvider>();
      inventory.load(page: inventory.result?.page ?? 1);
    }
  }

  Future<void> _toggleActive(Part part) async {
    final InventoryProvider inventory = context.read<InventoryProvider>();
    final bool darDeBaja = part.active;
    if (darDeBaja) {
      final bool confirmar = await showConfirmDialog(
        context,
        title: 'Dar de baja la refacción',
        message:
            '${confirmationText('dar de baja ${part.name}', irreversible: false)} '
            'Dejará de ofrecerse en las órdenes, pero se conserva todo su historial.',
        confirmLabel: 'Dar de baja',
      );
      if (!confirmar || !mounted) return;
    }
    try {
      await inventory.setActive(part.id, active: !darDeBaja);
      if (!mounted) return;
      showAppSnackBar(
        context,
        darDeBaja ? 'Refacción dada de baja correctamente.' : 'Refacción reactivada correctamente.',
      );
      inventory.load(page: inventory.result?.page ?? 1);
    } on ApiError catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final InventoryProvider inventory = context.watch<InventoryProvider>();
    final PagedResult<Part>? result = inventory.result;

    return AppShell(
      currentRoute: AppRoutes.inventory,
      title: 'Inventario',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.md,
                    children: <Widget>[
                      SizedBox(
                        width: 320,
                        child: TextField(
                          controller: _searchController,
                          onChanged: _onSearchChanged,
                          decoration: const InputDecoration(
                            hintText: 'Buscar por código o nombre',
                            prefixIcon: Icon(LucideIcons.search, size: 18),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 170,
                        child: DropdownButtonFormField<bool?>(
                          key: ValueKey<bool?>(inventory.activeFilter),
                          initialValue: inventory.activeFilter,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Estado'),
                          items: const <DropdownMenuItem<bool?>>[
                            DropdownMenuItem<bool?>(value: null, child: Text('Todas')),
                            DropdownMenuItem<bool?>(value: true, child: Text('Activas')),
                            DropdownMenuItem<bool?>(value: false, child: Text('Inactivas')),
                          ],
                          onChanged: (bool? a) =>
                              inventory.load(page: 1, active: a, clearActive: a == null),
                        ),
                      ),
                      SizedBox(
                        width: 190,
                        child: DropdownButtonFormField<AlertFilter?>(
                          key: ValueKey<AlertFilter?>(inventory.alertFilter),
                          initialValue: inventory.alertFilter,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Existencia'),
                          items: <DropdownMenuItem<AlertFilter?>>[
                            const DropdownMenuItem<AlertFilter?>(value: null, child: Text('Todas')),
                            for (final AlertFilter f in AlertFilter.values)
                              DropdownMenuItem<AlertFilter?>(value: f, child: Text(f.label)),
                          ],
                          onChanged: (AlertFilter? f) =>
                              inventory.load(page: 1, alert: f, clearAlert: f == null),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: () => _openForm(),
                  icon: const Icon(LucideIcons.plus, size: 18),
                  label: const Text('Nueva refacción'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            if (_mostrarAviso(inventory)) ...<Widget>[
              _AlertBanner(
                summary: inventory.alerts!,
                onShow: () => inventory.load(page: 1, alert: AlertFilter.any),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            Expanded(child: Panel(child: _buildBody(inventory, result))),
          ],
        ),
      ),
    );
  }

  /// El aviso de alertas se muestra mientras no se esté filtrando ya por alertas.
  bool _mostrarAviso(InventoryProvider inventory) =>
      inventory.alertFilter == null && (inventory.alerts?.total ?? 0) > 0;

  Widget _buildBody(InventoryProvider inventory, PagedResult<Part>? result) {
    if (inventory.error != null) {
      return ErrorStateView(message: inventory.error!, onRetry: () => inventory.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      return EmptyStateView(
        message: inventory.alertFilter != null
            ? 'No hay refacciones con esa alerta de existencia.'
            : inventory.hasFilters
            ? 'No se encontraron refacciones con esos filtros.'
            : 'Aún no hay refacciones registradas.',
        actionLabel: inventory.hasFilters ? null : 'Nueva refacción',
        onAction: inventory.hasFilters ? null : () => _openForm(),
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Código')),
                  DataColumn(label: Text('Nombre')),
                  DataColumn(label: Text('Existencia'), numeric: true),
                  DataColumn(label: Text('Mínimo'), numeric: true),
                  DataColumn(label: Text('Precio'), numeric: true),
                  DataColumn(label: Text('Estado')),
                  DataColumn(label: Text('Acciones')),
                ],
                rows: <DataRow>[
                  for (final Part p in result.items)
                    DataRow(
                      onSelectChanged: (_) => _openDetail(p),
                      cells: <DataCell>[
                        DataCell(Text(p.code)),
                        DataCell(Text(p.name, overflow: TextOverflow.ellipsis)),
                        DataCell(Text('${p.stock}')),
                        DataCell(Text('${p.minimumStock}')),
                        DataCell(Text(Format.money(p.price))),
                        DataCell(StockChip(part: p)),
                        DataCell(
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              IconButton(
                                tooltip: 'Editar refacción',
                                icon: const Icon(LucideIcons.pencil, size: 18),
                                onPressed: () => _openForm(p),
                              ),
                              IconButton(
                                tooltip: p.active ? 'Dar de baja' : 'Reactivar',
                                icon: Icon(
                                  p.active ? LucideIcons.archive : LucideIcons.archiveRestore,
                                  size: 18,
                                ),
                                onPressed: () => _toggleActive(p),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              if (inventory.loading)
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
        PaginationBar(result: result, onPage: (int p) => inventory.load(page: p)),
      ],
    );
  }
}

/// Aviso de refacciones por reabastecer con acceso directo al filtro de alertas.
class _AlertBanner extends StatelessWidget {
  const _AlertBanner({required this.summary, required this.onShow});

  final AlertsSummary summary;
  final VoidCallback onShow;

  @override
  Widget build(BuildContext context) {
    final Color color = summary.out > 0 ? AppColors.danger : AppColors.warning;
    final List<String> detalle = <String>[
      if (summary.low > 0) '${summary.low} con stock bajo',
      if (summary.out > 0) '${summary.out} agotada${summary.out == 1 ? '' : 's'}',
    ];
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.panelBorder,
        border: Border.all(color: color),
      ),
      child: Row(
        children: <Widget>[
          Icon(LucideIcons.triangleAlert, size: 20, color: color),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              '${summary.total} refacci${summary.total == 1 ? 'ón' : 'ones'} por reabastecer: ${detalle.join(' y ')}.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          OutlinedButton(onPressed: onShow, child: const Text('Ver alertas')),
        ],
      ),
    );
  }
}
