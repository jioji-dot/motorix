import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/order_status.dart';
import '../../models/paged_result.dart';
import '../../models/payment.dart';
import '../../models/service_order.dart';
import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/orders_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/status_chip.dart';

/// Listado de órdenes. El mecánico ve solo las suyas ("Mis órdenes"); recepción y administración, todas.
class OrdersListScreen extends StatefulWidget {
  const OrdersListScreen({super.key});

  @override
  State<OrdersListScreen> createState() => _OrdersListScreenState();
}

class _OrdersListScreenState extends State<OrdersListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  List<MechanicOption> _mechanics = <MechanicOption>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<OrdersProvider>().load(
            page: 1,
            search: '',
            clearStatus: true,
            clearMechanic: true,
            dueOnly: false,
          );
      _loadMechanics();
    });
  }

  Future<void> _loadMechanics() async {
    final UserRole? rol = context.read<AuthProvider>().role;
    if (rol == null || rol == UserRole.mechanic) return; // el mecánico no filtra por mecánico
    try {
      final List<MechanicOption> lista = await context.read<OrdersProvider>().mechanics();
      if (mounted) setState(() => _mechanics = lista);
    } catch (_) {
      // El filtro por mecánico es opcional: si falla, simplemente no se ofrece.
    }
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
      if (mounted) context.read<OrdersProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _newOrder() async {
    final Object? id = await Navigator.of(context).pushNamed(AppRoutes.orderForm);
    if (!mounted || id is! int) return;
    context.read<OrdersProvider>().load(page: 1);
    await Navigator.of(context).pushNamed(AppRoutes.orderDetail, arguments: id);
    if (mounted) context.read<OrdersProvider>().load();
  }

  Future<void> _openDetail(int id) async {
    await Navigator.of(context).pushNamed(AppRoutes.orderDetail, arguments: id);
    if (mounted) context.read<OrdersProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final OrdersProvider ordenes = context.watch<OrdersProvider>();
    final UserRole? rol = context.watch<AuthProvider>().role;
    final bool esMecanico = rol == UserRole.mechanic;
    final PagedResult<ServiceOrder>? result = ordenes.result;

    return AppShell(
      currentRoute: AppRoutes.orders,
      title: esMecanico ? 'Mis órdenes' : 'Órdenes de servicio',
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
                        width: 300,
                        child: TextField(
                          controller: _searchController,
                          onChanged: _onSearchChanged,
                          decoration: const InputDecoration(
                            hintText: 'Buscar por folio, cliente o placa',
                            prefixIcon: Icon(LucideIcons.search, size: 18),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 210,
                        child: DropdownButtonFormField<OrderStatus?>(
                          key: ValueKey<OrderStatus?>(ordenes.statusFilter),
                          initialValue: ordenes.statusFilter,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Estado'),
                          items: <DropdownMenuItem<OrderStatus?>>[
                            const DropdownMenuItem<OrderStatus?>(value: null, child: Text('Todos')),
                            for (final OrderStatus e in OrderStatus.values)
                              DropdownMenuItem<OrderStatus?>(value: e, child: Text(e.label)),
                          ],
                          onChanged: (OrderStatus? e) =>
                              ordenes.load(page: 1, status: e, clearStatus: e == null),
                        ),
                      ),
                      if (!esMecanico)
                        SizedBox(
                          width: 170,
                          child: DropdownButtonFormField<bool>(
                            key: ValueKey<bool>(ordenes.dueFilter),
                            initialValue: ordenes.dueFilter,
                            isExpanded: true,
                            decoration: const InputDecoration(labelText: 'Pago'),
                            items: const <DropdownMenuItem<bool>>[
                              DropdownMenuItem<bool>(value: false, child: Text('Todas')),
                              DropdownMenuItem<bool>(value: true, child: Text('Por cobrar')),
                            ],
                            onChanged: (bool? v) => ordenes.load(page: 1, dueOnly: v ?? false),
                          ),
                        ),
                      if (!esMecanico && _mechanics.isNotEmpty)
                        SizedBox(
                          width: 210,
                          child: DropdownButtonFormField<int?>(
                            key: ValueKey<int?>(ordenes.mechanicFilter),
                            initialValue: ordenes.mechanicFilter,
                            isExpanded: true,
                            decoration: const InputDecoration(labelText: 'Mecánico'),
                            items: <DropdownMenuItem<int?>>[
                              const DropdownMenuItem<int?>(value: null, child: Text('Todos')),
                              for (final MechanicOption m in _mechanics)
                                DropdownMenuItem<int?>(value: m.id, child: Text(m.name)),
                            ],
                            onChanged: (int? id) =>
                                ordenes.load(page: 1, mechanicId: id, clearMechanic: id == null),
                          ),
                        ),
                    ],
                  ),
                ),
                if (!esMecanico) ...<Widget>[
                  const SizedBox(width: AppSpacing.lg),
                  FilledButton.icon(
                    onPressed: _newOrder,
                    icon: const Icon(LucideIcons.plus, size: 18),
                    label: const Text('Nueva orden'),
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: Panel(child: _buildBody(ordenes, result, esMecanico))),
          ],
        ),
      ),
    );
  }

  /// Chip del estado de pago; solo tiene sentido en órdenes terminadas o entregadas.
  Widget _chipDePago(ServiceOrder o) {
    final OrderPaymentStatus? estado = o.paymentStatus;
    if (estado == null || !o.status.isClosedForWork || estado == OrderPaymentStatus.noCharge) {
      return const Text('—');
    }
    return StatusChip(label: estado.label, color: estado.color);
  }

  Widget _buildBody(OrdersProvider ordenes, PagedResult<ServiceOrder>? result, bool esMecanico) {
    if (ordenes.error != null) {
      return ErrorStateView(message: ordenes.error!, onRetry: () => ordenes.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      final String mensaje = ordenes.hasFilters
          ? 'No se encontraron órdenes con esos filtros.'
          : esMecanico
              ? 'No tienes órdenes asignadas por ahora.'
              : 'Aún no hay órdenes de servicio.';
      return EmptyStateView(
        message: mensaje,
        actionLabel: (!esMecanico && !ordenes.hasFilters) ? 'Crear la primera orden' : null,
        onAction: (!esMecanico && !ordenes.hasFilters) ? _newOrder : null,
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: <DataColumn>[
                  const DataColumn(label: Text('Folio')),
                  const DataColumn(label: Text('Vehículo')),
                  const DataColumn(label: Text('Cliente')),
                  if (!esMecanico) const DataColumn(label: Text('Mecánico')),
                  const DataColumn(label: Text('Problema')),
                  const DataColumn(label: Text('Estado')),
                  if (!esMecanico) const DataColumn(label: Text('Pago')),
                  const DataColumn(label: Text('Total'), numeric: true),
                ],
                rows: <DataRow>[
                  for (final ServiceOrder o in result.items)
                    DataRow(
                      onSelectChanged: (_) => _openDetail(o.id),
                      cells: <DataCell>[
                        DataCell(Text(o.folio)),
                        DataCell(Text('${o.vehiclePlate} · ${o.vehicleTitle}')),
                        DataCell(Text(o.clientName, overflow: TextOverflow.ellipsis)),
                        if (!esMecanico)
                          DataCell(Text(Format.orDash(o.mechanicName), overflow: TextOverflow.ellipsis)),
                        DataCell(
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 240),
                            child: Text(o.reportedProblem, overflow: TextOverflow.ellipsis),
                          ),
                        ),
                        DataCell(StatusChip(label: o.status.label, color: o.status.color)),
                        if (!esMecanico)
                          DataCell(_chipDePago(o)),
                        DataCell(Text(Format.money(o.total))),
                      ],
                    ),
                ],
              ),
              if (ordenes.loading)
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
        PaginationBar(result: result, onPage: (int p) => ordenes.load(page: p)),
      ],
    );
  }
}
