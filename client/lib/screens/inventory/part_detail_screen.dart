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
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/stock_chip.dart';
import '../../widgets/stock_movement_dialog.dart';

/// Detalle de una refacción: existencia, estado y movimientos de inventario (solo ADMIN).
class PartDetailScreen extends StatefulWidget {
  const PartDetailScreen({super.key, required this.partId});

  final int partId;

  @override
  State<PartDetailScreen> createState() => _PartDetailScreenState();
}

class _PartDetailScreenState extends State<PartDetailScreen> {
  Part? _part;
  PagedResult<InventoryMovement>? _movements;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load({int page = 1}) async {
    final InventoryProvider inventory = context.read<InventoryProvider>();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final Part part = await inventory.fetchPart(widget.partId);
      final PagedResult<InventoryMovement> movimientos =
          await inventory.fetchMovements(widget.partId, page: page);
      if (!mounted) return;
      setState(() {
        _part = part;
        _movements = movimientos;
        _loading = false;
      });
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _edit() async {
    final Object? guardado = await Navigator.of(context).pushNamed(
      AppRoutes.inventoryForm,
      arguments: _part,
    );
    if (guardado == true && mounted) _load();
  }

  Future<void> _operate(StockOperation operation) async {
    final Part part = _part!;
    final StockMovementInput? datos =
        await showStockMovementDialog(context, operation: operation, part: part);
    if (datos == null || !mounted) return;
    final InventoryProvider inventory = context.read<InventoryProvider>();
    try {
      if (operation == StockOperation.entry) {
        await inventory.registerEntry(part.id, quantity: datos.value, reason: datos.reason);
      } else {
        await inventory.registerAdjustment(part.id, newStock: datos.value, reason: datos.reason);
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        operation == StockOperation.entry
            ? 'Entrada registrada correctamente.'
            : 'Ajuste registrado correctamente.',
      );
      _load();
    } on ApiError catch (error) {
      if (!mounted) return;
      final String? campo = error.fieldMessage('newStock') ?? error.fieldMessage('quantity');
      showAppSnackBar(context, campo ?? error.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Part? part = _part;
    Widget body;
    if (_error != null) {
      body = ErrorStateView(message: _error!, onRetry: _load);
    } else if (part == null || _movements == null) {
      body = const LoadingView();
    } else {
      body = _buildContent(part, _movements!);
    }
    return AppShell(currentRoute: AppRoutes.inventory, title: 'Detalle de la refacción', child: body);
  }

  Widget _buildContent(Part part, PagedResult<InventoryMovement> movimientos) {
    final TextTheme text = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Panel(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(child: Text(part.name, style: text.titleLarge)),
                    StockChip(part: part),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                DetailRow(label: 'Código', value: part.code),
                DetailRow(label: 'Descripción', value: Format.orDash(part.description)),
                DetailRow(label: 'Precio', value: Format.money(part.price)),
                DetailRow(label: 'Existencia', value: '${part.stock}'),
                DetailRow(label: 'Stock mínimo', value: '${part.minimumStock}'),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: <Widget>[
                    FilledButton.icon(
                      onPressed: () => _operate(StockOperation.entry),
                      icon: const Icon(LucideIcons.packagePlus, size: 18),
                      label: const Text('Registrar entrada'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _operate(StockOperation.adjustment),
                      icon: const Icon(LucideIcons.slidersHorizontal, size: 18),
                      label: const Text('Ajustar existencia'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _edit,
                      icon: const Icon(LucideIcons.pencil, size: 18),
                      label: const Text('Editar datos'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Text('Movimientos de inventario', style: text.titleMedium),
          const SizedBox(height: AppSpacing.md),
          Panel(
            child: movimientos.items.isEmpty
                ? const SizedBox(
                    height: 120,
                    child: EmptyStateView(message: 'Esta refacción aún no tiene movimientos.'),
                  )
                : Column(
                    children: <Widget>[
                      SizedBox(
                        height: (movimientos.items.length * 52.0 + 60).clamp(120, 560).toDouble(),
                        child: AppDataTable(
                          columns: const <DataColumn>[
                            DataColumn(label: Text('Fecha')),
                            DataColumn(label: Text('Tipo')),
                            DataColumn(label: Text('Cantidad'), numeric: true),
                            DataColumn(label: Text('Motivo')),
                            DataColumn(label: Text('Orden')),
                            DataColumn(label: Text('Usuario')),
                          ],
                          rows: <DataRow>[
                            for (final InventoryMovement m in movimientos.items)
                              DataRow(cells: <DataCell>[
                                DataCell(Text(Format.instant(m.createdAt))),
                                DataCell(Text(m.type.label)),
                                DataCell(Text(
                                  m.quantity > 0 ? '+${m.quantity}' : '${m.quantity}',
                                  style: TextStyle(
                                    color: m.quantity < 0 ? AppColors.danger : AppColors.success,
                                  ),
                                )),
                                DataCell(Text(m.reason, overflow: TextOverflow.ellipsis)),
                                DataCell(Text(Format.orDash(m.orderFolio))),
                                DataCell(Text(Format.orDash(m.createdByName))),
                              ]),
                          ],
                        ),
                      ),
                      PaginationBar(result: movimientos, onPage: (int p) => _load(page: p)),
                    ],
                  ),
          ),
          if (_loading) const SizedBox(height: AppSpacing.md),
        ],
      ),
    );
  }
}
