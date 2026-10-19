import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/appointment.dart';
import '../providers/appointments_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/list_toolbar.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'appointment_detail_screen.dart';
import 'appointment_form_screen.dart';
import 'order_form_screen.dart';

/// Agenda de citas con búsqueda y filtros por estado y periodo (solo recepción y administración).
class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppointmentsProvider>().load(page: 1);
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
      if (mounted) context.read<AppointmentsProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm({Appointment? appointment}) async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AppointmentFormScreen(appointment: appointment)),
    );
    if (guardado == true && mounted) context.read<AppointmentsProvider>().load();
  }

  Future<void> _openDetail(Appointment appointment) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => AppointmentDetailScreen(appointmentId: appointment.id, onCreateOrder: crearOrdenDesdeCita),
      ),
    );
    if (mounted) context.read<AppointmentsProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppointmentsProvider>();

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
                hintText: 'Buscar por cliente o placas',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
            ),
            actions: [
              SizedBox(
                width: 190,
                child: DropdownButtonFormField<String?>(
                  key: const Key('filtro-estado-cita'),
                  isExpanded: true,
                  initialValue: provider.statusFilter,
                  decoration: const InputDecoration(labelText: 'Estado'),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Todos')),
                    DropdownMenuItem(value: 'PENDIENTE', child: Text('Pendientes')),
                    DropdownMenuItem(value: 'CONFIRMADA', child: Text('Confirmadas')),
                    DropdownMenuItem(value: 'EN_PROCESO', child: Text('En proceso')),
                    DropdownMenuItem(value: 'COMPLETADA', child: Text('Completadas')),
                    DropdownMenuItem(value: 'CANCELADA', child: Text('Canceladas')),
                  ],
                  onChanged: (valor) => context.read<AppointmentsProvider>().setStatusFilter(valor),
                ),
              ),
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<AppointmentPeriod>(
                  key: const Key('filtro-periodo'),
                  isExpanded: true,
                  initialValue: provider.period,
                  decoration: const InputDecoration(labelText: 'Periodo'),
                  items: [
                    for (final p in AppointmentPeriod.values) DropdownMenuItem(value: p, child: Text(p.label)),
                  ],
                  onChanged: (valor) {
                    if (valor != null) context.read<AppointmentsProvider>().setPeriod(valor);
                  },
                ),
              ),
              FilledButton(
                onPressed: () => _openForm(),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.plus, size: 18),
                    SizedBox(width: AppSpacing.sm),
                    Flexible(child: Text('Registrar cita', overflow: TextOverflow.ellipsis)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: _buildBody(provider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(AppointmentsProvider provider) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando citas...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty ||
          provider.statusFilter != null ||
          provider.period != AppointmentPeriod.all;
      return EmptyState(
        icon: LucideIcons.calendarDays,
        title: filtrando ? 'No se encontraron citas' : 'Aún no hay citas',
        message: filtrando
            ? 'Prueba con otro cliente, placas, estado o periodo.'
            : 'Las citas que agendes aparecerán aquí.',
        actionLabel: filtrando ? null : 'Registrar cita',
        onAction: filtrando ? null : () => _openForm(),
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 900,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Fecha y hora'), size: ColumnSize.M),
              DataColumn2(label: Text('Cliente'), size: ColumnSize.L),
              DataColumn2(label: Text('Placas'), size: ColumnSize.S),
              DataColumn2(label: Text('Motivo'), size: ColumnSize.L),
              DataColumn2(label: Text('Estado'), size: ColumnSize.M),
              DataColumn2(label: Text('Acciones'), fixedWidth: 110),
            ],
            rows: [
              for (final cita in provider.items)
                DataRow2(
                  onTap: () => _openDetail(cita),
                  cells: [
                    DataCell(Text(formatDateTime(cita.scheduledAt))),
                    DataCell(Text(cita.clientName, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(cita.licensePlate)),
                    DataCell(Text(cita.reason, overflow: TextOverflow.ellipsis)),
                    DataCell(StatusChip.appointment(cita.status)),
                    DataCell(Row(
                      children: [
                        IconButton(
                          tooltip: 'Ver detalle',
                          onPressed: () => _openDetail(cita),
                          icon: const Icon(LucideIcons.eye, size: 18),
                        ),
                        if (cita.isEditable)
                          IconButton(
                            tooltip: 'Editar',
                            onPressed: () => _openForm(appointment: cita),
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
              Expanded(
                child: Text(
                  '${provider.total} cita${provider.total == 1 ? '' : 's'}',
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
