import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/appointment.dart';
import '../../models/order_status.dart';
import '../../models/paged_result.dart';
import '../../providers/appointments_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/status_chip.dart';
import '../orders/order_form_screen.dart';

/// Listado de citas con búsqueda, filtros de fecha y estado, y paginación (ADMIN y RECEPTIONIST).
class AppointmentsListScreen extends StatefulWidget {
  const AppointmentsListScreen({super.key});

  @override
  State<AppointmentsListScreen> createState() => _AppointmentsListScreenState();
}

class _AppointmentsListScreenState extends State<AppointmentsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<AppointmentsProvider>().load(
              page: 1,
              search: '',
              clearDate: true,
              clearStatus: true,
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
      if (mounted) context.read<AppointmentsProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _pickDate() async {
    final DateTime hoy = DateTime.now();
    final DateTime? dia = await showDatePicker(
      context: context,
      initialDate: hoy,
      firstDate: DateTime(hoy.year - 2),
      lastDate: DateTime(hoy.year + 2),
      helpText: 'Filtrar por fecha',
      cancelText: 'Cancelar',
      confirmText: 'Aceptar',
    );
    if (dia == null || !mounted) return;
    final String p = dia.month.toString().padLeft(2, '0');
    final String d = dia.day.toString().padLeft(2, '0');
    context.read<AppointmentsProvider>().load(page: 1, date: '${dia.year}-$p-$d');
  }

  Future<void> _openForm([Appointment? cita]) async {
    final Object? guardada = await Navigator.of(context).pushNamed(
      AppRoutes.appointmentForm,
      arguments: cita,
    );
    if (guardada == true && mounted) context.read<AppointmentsProvider>().load(page: 1);
  }

  @override
  Widget build(BuildContext context) {
    final AppointmentsProvider citas = context.watch<AppointmentsProvider>();
    final PagedResult<Appointment>? result = citas.result;
    final String? fecha = citas.dateFilter;

    return AppShell(
      currentRoute: AppRoutes.appointments,
      title: 'Citas',
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
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: <Widget>[
                      SizedBox(
                        width: 300,
                        child: TextField(
                          controller: _searchController,
                          onChanged: _onSearchChanged,
                          decoration: const InputDecoration(
                            hintText: 'Buscar por cliente o placa',
                            prefixIcon: Icon(LucideIcons.search, size: 18),
                          ),
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(LucideIcons.calendarDays, size: 18),
                        label: Text(
                          fecha == null
                              ? 'Fecha'
                              : '${fecha.substring(8, 10)}/${fecha.substring(5, 7)}/${fecha.substring(0, 4)}',
                        ),
                      ),
                      if (fecha != null)
                        IconButton(
                          tooltip: 'Quitar filtro de fecha',
                          icon: const Icon(LucideIcons.x, size: 18),
                          onPressed: () => citas.load(page: 1, clearDate: true),
                        ),
                      SizedBox(
                        width: 190,
                        child: DropdownButtonFormField<AppointmentStatus?>(
                          key: ValueKey<AppointmentStatus?>(citas.statusFilter),
                          initialValue: citas.statusFilter,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Estado'),
                          items: <DropdownMenuItem<AppointmentStatus?>>[
                            const DropdownMenuItem<AppointmentStatus?>(
                              value: null,
                              child: Text('Todos'),
                            ),
                            for (final AppointmentStatus e in AppointmentStatus.values)
                              DropdownMenuItem<AppointmentStatus?>(value: e, child: Text(e.label)),
                          ],
                          onChanged: (AppointmentStatus? e) =>
                              citas.load(page: 1, status: e, clearStatus: e == null),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: () => _openForm(),
                  icon: const Icon(LucideIcons.plus, size: 18),
                  label: const Text('Nueva cita'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: Panel(child: _buildBody(citas, result))),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(AppointmentsProvider citas, PagedResult<Appointment>? result) {
    if (citas.error != null) {
      return ErrorStateView(message: citas.error!, onRetry: () => citas.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      return EmptyStateView(
        message: citas.hasFilters
            ? 'No se encontraron citas con esos filtros.'
            : 'Aún no hay citas registradas.',
        actionLabel: citas.hasFilters ? null : 'Registrar la primera cita',
        onAction: citas.hasFilters ? null : () => _openForm(),
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Fecha y hora')),
                  DataColumn(label: Text('Cliente')),
                  DataColumn(label: Text('Vehículo')),
                  DataColumn(label: Text('Motivo')),
                  DataColumn(label: Text('Estado')),
                  DataColumn(label: Text('Acciones')),
                ],
                rows: <DataRow>[
                  for (final Appointment c in result.items)
                    DataRow(
                      cells: <DataCell>[
                        DataCell(Text(Format.dateTime(c.scheduledAt))),
                        DataCell(Text(c.clientName, overflow: TextOverflow.ellipsis)),
                        DataCell(Text('${c.vehiclePlate} · ${c.vehicleTitle}')),
                        DataCell(
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 220),
                            child: Text(c.reason, overflow: TextOverflow.ellipsis),
                          ),
                        ),
                        DataCell(StatusChip(label: c.status.label, color: c.status.color)),
                        DataCell(Row(mainAxisSize: MainAxisSize.min, children: _actions(c))),
                      ],
                    ),
                ],
              ),
              if (citas.loading)
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
        PaginationBar(result: result, onPage: (int p) => citas.load(page: p)),
      ],
    );
  }

  Future<void> _createOrder(Appointment cita) async {
    final Object? creada = await Navigator.of(context).pushNamed(
      AppRoutes.orderForm,
      arguments: OrderFormArgs(appointment: cita),
    );
    if (!mounted) return;
    if (creada is int) {
      await Navigator.of(context).pushNamed(AppRoutes.orderDetail, arguments: creada);
    }
    if (mounted) context.read<AppointmentsProvider>().load();
  }

  Future<void> _confirm(Appointment cita) async {
    try {
      await context.read<AppointmentsProvider>().confirm(cita.id);
      if (!mounted) return;
      showAppSnackBar(context, 'Cita confirmada.');
    } on ApiError catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    }
    if (mounted) context.read<AppointmentsProvider>().load();
  }

  Future<void> _cancel(Appointment cita) async {
    final bool confirmar = await showConfirmDialog(
      context,
      title: 'Cancelar cita',
      message: confirmationText(
        'cancelar la cita de ${cita.clientName} del ${Format.dateTime(cita.scheduledAt)}',
        irreversible: false,
      ),
      confirmLabel: 'Confirmar',
    );
    if (!confirmar || !mounted) return;
    try {
      await context.read<AppointmentsProvider>().cancel(cita.id);
      if (!mounted) return;
      showAppSnackBar(context, 'Cita cancelada.');
    } on ApiError catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    }
    if (mounted) context.read<AppointmentsProvider>().load();
  }

  /// Acciones de cada fila según el estado de la cita.
  List<Widget> _actions(Appointment cita) => <Widget>[
        if (cita.orderId != null)
          IconButton(
            tooltip: 'Ver orden de servicio',
            icon: const Icon(LucideIcons.clipboardList, size: 18),
            onPressed: () => Navigator.of(context).pushNamed(
              AppRoutes.orderDetail,
              arguments: cita.orderId,
            ),
          ),
        if (cita.isOpen) ...<Widget>[
          IconButton(
            tooltip: 'Crear orden de servicio',
            icon: const Icon(LucideIcons.clipboardCheck, size: 18),
            onPressed: () => _createOrder(cita),
          ),
          if (cita.status == AppointmentStatus.pending)
            IconButton(
              tooltip: 'Confirmar cita',
              icon: const Icon(LucideIcons.check, size: 18),
              onPressed: () => _confirm(cita),
            ),
          IconButton(
            tooltip: 'Modificar cita',
            icon: const Icon(LucideIcons.pencil, size: 18),
            onPressed: () => _openForm(cita),
          ),
          IconButton(
            tooltip: 'Cancelar cita',
            icon: const Icon(LucideIcons.ban, size: 18),
            onPressed: () => _cancel(cita),
          ),
        ],
      ];
}
