import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/appointment.dart';
import '../providers/appointments_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'appointment_form_screen.dart';

/// Detalle de una cita con las acciones permitidas según su estado.
class AppointmentDetailScreen extends StatefulWidget {
  const AppointmentDetailScreen({super.key, required this.appointmentId, this.onCreateOrder});

  final int appointmentId;

  /// Acción "Crear orden" (se conecta desde la pantalla de órdenes).
  final Future<void> Function(BuildContext context, Appointment appointment)? onCreateOrder;

  @override
  State<AppointmentDetailScreen> createState() => _AppointmentDetailScreenState();
}

class _AppointmentDetailScreenState extends State<AppointmentDetailScreen> {
  Appointment? _appointment;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cita = await context.read<AppointmentsProvider>().fetchDetail(widget.appointmentId);
      if (mounted) setState(() => _appointment = cita);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => AppointmentFormScreen(appointment: _appointment)),
    );
    if (guardado == true) await _load();
  }

  Future<void> _ejecutar(Future<Object?> Function() accion, String exito) async {
    try {
      await accion();
      if (!mounted) return;
      showFeedback(context, exito);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
    }
  }

  Future<void> _confirm() => _ejecutar(
        () => context.read<AppointmentsProvider>().confirm(widget.appointmentId),
        'Cita confirmada.',
      );

  Future<void> _cancel() async {
    final confirmado = await showConfirmDialog(
      context,
      title: 'Cancelar cita',
      message: 'La cita se conservará en el historial como Cancelada y ya no podrá modificarse.',
      destructive: true,
    );
    if (!confirmado || !mounted) return;
    await _ejecutar(() => context.read<AppointmentsProvider>().cancel(widget.appointmentId), 'Cita cancelada.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de la cita'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _appointment == null) return const LoadingState();
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final cita = _appointment!;
    final texto = Theme.of(context).textTheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(formatDateTime(cita.scheduledAt), style: texto.titleLarge)),
                      StatusChip.appointment(cita.status),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _Dato(etiqueta: 'Cliente', valor: cita.clientName),
                  _Dato(etiqueta: 'Vehículo', valor: '${cita.vehicleTitle} · ${cita.licensePlate}'),
                  _Dato(etiqueta: 'Motivo', valor: cita.reason),
                  _Dato(etiqueta: 'Observaciones', valor: (cita.notes ?? '').isEmpty ? '—' : cita.notes!),
                  if (cita.hasActiveOrder) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Esta cita tiene una orden de servicio activa. Para cancelar la cita, cancela primero la orden.',
                      style: texto.bodyMedium?.copyWith(color: AppColors.textSecondary),
                    ),
                  ],
                  if (cita.isEditable || (cita.status == 'CONFIRMADA' && widget.onCreateOrder != null)) ...[
                    const SizedBox(height: AppSpacing.lg),
                    Wrap(
                      spacing: AppSpacing.md,
                      runSpacing: AppSpacing.md,
                      children: [
                        if (cita.status == 'CONFIRMADA' && !cita.hasActiveOrder && widget.onCreateOrder != null)
                          FilledButton(
                            onPressed: () async {
                              await widget.onCreateOrder!(context, cita);
                              if (mounted) await _load();
                            },
                            child: const Text('Crear orden'),
                          ),
                        if (cita.status == 'PENDIENTE')
                          OutlinedButton(onPressed: _confirm, child: const Text('Confirmar cita')),
                        if (cita.isEditable) OutlinedButton(onPressed: _edit, child: const Text('Editar')),
                        if (cita.isEditable && !cita.hasActiveOrder)
                          OutlinedButton(onPressed: _cancel, child: const Text('Cancelar cita')),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140, child: Text(etiqueta, style: texto.bodySmall)),
          Expanded(child: Text(valor, style: texto.bodyLarge)),
        ],
      ),
    );
  }
}
