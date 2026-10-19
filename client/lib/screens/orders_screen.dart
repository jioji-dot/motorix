import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/service_order.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/list_toolbar.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'order_detail_screen.dart';
import 'order_form_screen.dart';

const _estadosFiltro = <(String?, String)>[
  (null, 'Todos'),
  ('RECIBIDO', 'Recibido'),
  ('DIAGNOSTICO', 'Diagnóstico'),
  ('EN_REPARACION', 'En reparación'),
  ('ESPERANDO_REFACCION', 'Esperando refacción'),
  ('TERMINADO', 'Terminado'),
  ('ENTREGADO', 'Entregado'),
  ('CANCELADA', 'Cancelada'),
];

/// Lista de órdenes de servicio. El mecánico solo recibe las suyas (el servidor lo garantiza).
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<OrdersProvider>().load(page: 1);
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
      if (mounted) context.read<OrdersProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm() async {
    final creada = await Navigator.of(context).push<ServiceOrder>(
      MaterialPageRoute(builder: (_) => const OrderFormScreen()),
    );
    if (creada != null && mounted) context.read<OrdersProvider>().load();
  }

  Future<void> _openDetail(ServiceOrder orden) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: orden.id)),
    );
    if (mounted) context.read<OrdersProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrdersProvider>();
    final puedeCrear = context.select<AuthProvider, bool>((a) => a.canManageRecords);
    final esMecanico = context.select<AuthProvider, bool>((a) => !a.canManageRecords);

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
                hintText: 'Buscar por folio, cliente o placas',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
            ),
            actions: [
              SizedBox(
                width: 210,
                child: DropdownButtonFormField<String?>(
                  key: const Key('filtro-estado-orden'),
                  isExpanded: true,
                  initialValue: provider.statusFilter,
                  decoration: const InputDecoration(labelText: 'Estado'),
                  items: [
                    for (final (valor, etiqueta) in _estadosFiltro)
                      DropdownMenuItem(value: valor, child: Text(etiqueta, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (valor) => context.read<OrdersProvider>().setStatusFilter(valor),
                ),
              ),
              if (puedeCrear)
                FilledButton(
                  onPressed: _openForm,
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.plus, size: 18),
                      SizedBox(width: AppSpacing.sm),
                      Flexible(child: Text('Nueva orden', overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: _buildBody(provider, puedeCrear, esMecanico),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(OrdersProvider provider, bool puedeCrear, bool esMecanico) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando órdenes...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty || provider.statusFilter != null;
      if (filtrando) {
        return const EmptyState(
          icon: LucideIcons.clipboardList,
          title: 'No se encontraron órdenes',
          message: 'Prueba con otro folio, cliente, placas o estado.',
        );
      }
      return EmptyState(
        icon: LucideIcons.clipboardList,
        title: esMecanico ? 'No tienes órdenes asignadas' : 'Aún no hay órdenes de servicio',
        message: esMecanico
            ? 'Cuando recepción te asigne una orden aparecerá aquí.'
            : 'Las órdenes que crees aparecerán aquí.',
        actionLabel: puedeCrear ? 'Nueva orden' : null,
        onAction: puedeCrear ? _openForm : null,
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 980,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Folio'), size: ColumnSize.S),
              DataColumn2(label: Text('Fecha'), size: ColumnSize.S),
              DataColumn2(label: Text('Cliente'), size: ColumnSize.L),
              DataColumn2(label: Text('Placas'), size: ColumnSize.S),
              DataColumn2(label: Text('Mecánico'), size: ColumnSize.M),
              DataColumn2(label: Text('Estado'), size: ColumnSize.M),
              DataColumn2(label: Text('Total'), size: ColumnSize.S, numeric: true),
              DataColumn2(label: Text('Acciones'), fixedWidth: 80),
            ],
            rows: [
              for (final orden in provider.items)
                DataRow2(
                  onTap: () => _openDetail(orden),
                  cells: [
                    DataCell(Text(orden.folio)),
                    DataCell(Text(formatDate(orden.createdAt))),
                    DataCell(Text(orden.clientName, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(orden.licensePlate)),
                    DataCell(Text(orden.mechanicName, overflow: TextOverflow.ellipsis)),
                    DataCell(StatusChip.order(orden.status)),
                    DataCell(Text(formatMoney(orden.total))),
                    DataCell(IconButton(
                      tooltip: 'Ver detalle',
                      onPressed: () => _openDetail(orden),
                      icon: const Icon(LucideIcons.eye, size: 18),
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
                  '${provider.total} orden${provider.total == 1 ? '' : 'es'}',
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
