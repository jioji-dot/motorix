import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/paged_result.dart';
import '../../models/payment.dart';
import '../../providers/payments_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/status_chip.dart';

/// Listado general de pagos con filtros por texto, estado, método y fechas (administración y recepción).
class PaymentsListScreen extends StatefulWidget {
  const PaymentsListScreen({super.key});

  @override
  State<PaymentsListScreen> createState() => _PaymentsListScreenState();
}

class _PaymentsListScreenState extends State<PaymentsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<PaymentsProvider>().load(page: 1, search: '');
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
      if (mounted) context.read<PaymentsProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final PaymentsProvider provider = context.read<PaymentsProvider>();
    final String? actual = isFrom ? provider.fromFilter : provider.toFilter;
    final DateTime inicial = (actual == null ? null : DateTime.tryParse(actual)) ?? DateTime.now();
    final DateTime? fecha = await showDatePicker(
      context: context,
      initialDate: inicial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      helpText: isFrom ? 'Pagos desde' : 'Pagos hasta',
    );
    if (fecha == null || !mounted) return;
    final String iso = Format.isoDate(fecha);
    await (isFrom ? provider.load(page: 1, from: iso) : provider.load(page: 1, to: iso));
  }

  void _clearFilters() {
    _searchController.clear();
    context.read<PaymentsProvider>().load(
          page: 1,
          search: '',
          clearStatus: true,
          clearMethod: true,
          clearDates: true,
        );
  }

  @override
  Widget build(BuildContext context) {
    final PaymentsProvider provider = context.watch<PaymentsProvider>();
    final PagedResult<Payment>? result = provider.result;

    return AppShell(
      currentRoute: AppRoutes.payments,
      title: 'Pagos',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              crossAxisAlignment: WrapCrossAlignment.center,
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
                  width: 170,
                  child: DropdownButtonFormField<PaymentStatus?>(
                    key: ValueKey<PaymentStatus?>(provider.statusFilter),
                    initialValue: provider.statusFilter,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Estado'),
                    items: <DropdownMenuItem<PaymentStatus?>>[
                      const DropdownMenuItem<PaymentStatus?>(value: null, child: Text('Todos')),
                      for (final PaymentStatus s in PaymentStatus.values)
                        DropdownMenuItem<PaymentStatus?>(value: s, child: Text(s.label)),
                    ],
                    onChanged: (PaymentStatus? s) =>
                        provider.load(page: 1, status: s, clearStatus: s == null),
                  ),
                ),
                SizedBox(
                  width: 190,
                  child: DropdownButtonFormField<PaymentMethod?>(
                    key: ValueKey<PaymentMethod?>(provider.methodFilter),
                    initialValue: provider.methodFilter,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Método'),
                    items: <DropdownMenuItem<PaymentMethod?>>[
                      const DropdownMenuItem<PaymentMethod?>(value: null, child: Text('Todos')),
                      for (final PaymentMethod m in PaymentMethod.values)
                        DropdownMenuItem<PaymentMethod?>(value: m, child: Text(m.label)),
                    ],
                    onChanged: (PaymentMethod? m) =>
                        provider.load(page: 1, method: m, clearMethod: m == null),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: () => _pickDate(isFrom: true),
                  icon: const Icon(LucideIcons.calendar, size: 18),
                  label: Text(provider.fromFilter == null
                      ? 'Desde'
                      : 'Desde ${Format.dateOnly(provider.fromFilter)}'),
                ),
                OutlinedButton.icon(
                  onPressed: () => _pickDate(isFrom: false),
                  icon: const Icon(LucideIcons.calendar, size: 18),
                  label: Text(provider.toFilter == null
                      ? 'Hasta'
                      : 'Hasta ${Format.dateOnly(provider.toFilter)}'),
                ),
                if (provider.hasFilters)
                  TextButton(onPressed: _clearFilters, child: const Text('Limpiar filtros')),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Total aprobado con estos filtros: ${Format.money(provider.approvedTotal)}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: Panel(child: _buildBody(provider, result))),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(PaymentsProvider provider, PagedResult<Payment>? result) {
    if (provider.error != null) {
      return ErrorStateView(message: provider.error!, onRetry: () => provider.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      return EmptyStateView(
        message: provider.hasFilters
            ? 'No se encontraron pagos con esos filtros.'
            : 'Aún no hay pagos registrados.',
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Fecha')),
                  DataColumn(label: Text('Orden')),
                  DataColumn(label: Text('Cliente')),
                  DataColumn(label: Text('Vehículo')),
                  DataColumn(label: Text('Método')),
                  DataColumn(label: Text('Importe'), numeric: true),
                  DataColumn(label: Text('Estado')),
                  DataColumn(label: Text('Registró')),
                ],
                rows: <DataRow>[
                  for (final Payment p in result.items)
                    DataRow(
                      onSelectChanged: (_) =>
                          Navigator.of(context).pushNamed(AppRoutes.orderDetail, arguments: p.orderId),
                      cells: <DataCell>[
                        DataCell(Text(Format.instant(p.createdAt))),
                        DataCell(Text(p.orderFolio)),
                        DataCell(Text(p.clientName, overflow: TextOverflow.ellipsis)),
                        DataCell(Text(p.vehiclePlate)),
                        DataCell(Text(p.method.label)),
                        DataCell(Text(Format.money(p.amount))),
                        DataCell(StatusChip(label: p.status.label, color: p.status.color)),
                        DataCell(Text(p.createdByName)),
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
}
