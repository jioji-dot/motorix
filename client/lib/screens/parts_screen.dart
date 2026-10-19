import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/parts_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/list_toolbar.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'part_detail_screen.dart';
import 'part_form_screen.dart';

/// Inventario de refacciones: resumen de alertas, búsqueda, filtros y listado. Solo el administrador escribe.
class PartsScreen extends StatefulWidget {
  const PartsScreen({super.key});

  @override
  State<PartsScreen> createState() => _PartsScreenState();
}

class _PartsScreenState extends State<PartsScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<PartsProvider>().load(page: 1);
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
      if (mounted) context.read<PartsProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm() async {
    final guardado = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const PartFormScreen()));
    if (guardado == true && mounted) context.read<PartsProvider>().load();
  }

  Future<void> _openDetail(Part parte) async {
    await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => PartDetailScreen(partId: parte.id)));
    if (mounted) context.read<PartsProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PartsProvider>();
    final esAdmin = context.select<AuthProvider, bool>((a) => a.role == UserRole.admin);

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListToolbar(
            search: TextField(
              key: const Key('campo-busqueda'),
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'Buscar por código, nombre, categoría o marca',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
            ),
            actions: [
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String?>(
                  key: const Key('filtro-categoria'),
                  isExpanded: true,
                  initialValue: provider.categoryFilter,
                  decoration: const InputDecoration(labelText: 'Categoría'),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Todas')),
                    for (final categoria in provider.categories)
                      DropdownMenuItem<String?>(value: categoria, child: Text(categoria, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (valor) => context.read<PartsProvider>().setCategory(valor),
                ),
              ),
              FilterChip(
                key: const Key('filtro-stock-bajo'),
                label: const Text('Stock bajo'),
                selected: provider.onlyAlerts,
                onSelected: (valor) => context.read<PartsProvider>().setOnlyAlerts(valor),
              ),
              if (esAdmin)
                FilledButton(
                  onPressed: _openForm,
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.plus, size: 18),
                      SizedBox(width: AppSpacing.sm),
                      Flexible(child: Text('Registrar refacción', overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                ),
            ],
          ),
          if (provider.summary != null) ...[
            const SizedBox(height: AppSpacing.lg),
            _ResumenDeAlertas(resumen: provider.summary!),
          ],
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: _buildBody(provider, esAdmin),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(PartsProvider provider, bool esAdmin) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando refacciones...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty || provider.categoryFilter != null || provider.onlyAlerts;
      return EmptyState(
        icon: LucideIcons.package,
        title: filtrando ? 'No se encontraron refacciones' : 'Aún no hay refacciones',
        message: filtrando
            ? 'Prueba con otra búsqueda o quita los filtros.'
            : 'Las refacciones que registres aparecerán aquí.',
        actionLabel: (!filtrando && esAdmin) ? 'Registrar refacción' : null,
        onAction: (!filtrando && esAdmin) ? _openForm : null,
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: esAdmin ? 1000 : 880,
            showCheckboxColumn: false,
            columns: [
              const DataColumn2(label: Text('Código'), size: ColumnSize.S),
              const DataColumn2(label: Text('Nombre'), size: ColumnSize.L),
              const DataColumn2(label: Text('Categoría'), size: ColumnSize.M),
              const DataColumn2(label: Text('Stock'), fixedWidth: 80, numeric: true),
              const DataColumn2(label: Text('Nivel'), size: ColumnSize.S),
              const DataColumn2(label: Text('Precio de venta'), size: ColumnSize.S, numeric: true),
              if (esAdmin) const DataColumn2(label: Text('Precio de compra'), size: ColumnSize.S, numeric: true),
              const DataColumn2(label: Text('Acciones'), fixedWidth: 110),
            ],
            rows: [
              for (final parte in provider.items)
                DataRow2(
                  onTap: () => _openDetail(parte),
                  cells: [
                    DataCell(Text(parte.code, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(parte.name, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(parte.category, overflow: TextOverflow.ellipsis)),
                    DataCell(Text('${parte.stock}')),
                    DataCell(StatusChip.stock(parte.stockLevel)),
                    DataCell(Text(formatMoney(parte.salePrice))),
                    if (esAdmin) DataCell(Text(formatMoney(parte.purchasePrice))),
                    DataCell(Row(
                      children: [
                        IconButton(
                          tooltip: 'Ver detalle',
                          onPressed: () => _openDetail(parte),
                          icon: const Icon(LucideIcons.eye, size: 18),
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
              Expanded(
                child: Text(
                  '${provider.total} refacción${provider.total == 1 ? '' : 'es'}',
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              IconButton(
                tooltip: 'Página anterior',
                onPressed: provider.page > 1 ? () => provider.load(page: provider.page - 1) : null,
                icon: const Icon(LucideIcons.chevronLeft, size: 18),
              ),
              Text('${provider.page} de ${provider.totalPages}'),
              IconButton(
                tooltip: 'Página siguiente',
                onPressed: provider.page < provider.totalPages ? () => provider.load(page: provider.page + 1) : null,
                icon: const Icon(LucideIcons.chevronRight, size: 18),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Resumen de alertas de stock visible al abrir el inventario.
class _ResumenDeAlertas extends StatelessWidget {
  const _ResumenDeAlertas({required this.resumen});

  final StockSummary resumen;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final color = resumen.hasAlerts ? AppColors.warning : AppColors.success;
    final mensaje = resumen.hasAlerts
        ? '${resumen.low} con stock bajo · ${resumen.out} agotada${resumen.out == 1 ? '' : 's'}'
        : 'Todo el stock está en orden';
    return Container(
      key: const Key('resumen-de-alertas'),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.panel),
      ),
      child: Row(
        children: [
          Icon(resumen.hasAlerts ? LucideIcons.triangleAlert : LucideIcons.circleCheck, size: 18, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(mensaje, style: texto.bodyMedium, overflow: TextOverflow.ellipsis)),
          Text('${resumen.total} activas', style: texto.bodySmall),
        ],
      ),
    );
  }
}
