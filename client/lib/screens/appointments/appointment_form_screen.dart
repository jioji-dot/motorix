import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/appointment.dart';
import '../../models/client.dart';
import '../../providers/appointments_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../utils/validators.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/client_vehicle_picker.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/date_time_field.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Formulario de cita: alta (sin [appointment]) o edición (con [appointment]).
class AppointmentFormScreen extends StatefulWidget {
  const AppointmentFormScreen({super.key, this.appointment});

  final Appointment? appointment;

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _reason;
  late final TextEditingController _notes;

  Client? _client;
  int? _vehicleId;
  String? _scheduledAt;
  bool _clientTouched = false;
  bool _saving = false;
  bool _allowPop = false;
  Map<String, String> _serverErrors = <String, String>{};

  Appointment? get _appointment => widget.appointment;
  bool get _isEdit => _appointment != null;

  @override
  void initState() {
    super.initState();
    final Appointment? c = _appointment;
    _reason = TextEditingController(text: c?.reason ?? '');
    _notes = TextEditingController(text: c?.notes ?? '');
    _scheduledAt = c?.scheduledAt;
    if (c != null) {
      _client = Client(id: c.clientId, name: c.clientName, phone: '');
      _vehicleId = c.vehicleId;
    }
  }

  @override
  void dispose() {
    _reason.dispose();
    _notes.dispose();
    super.dispose();
  }

  bool get _dirty {
    final Appointment? c = _appointment;
    if (c == null) {
      return _client != null ||
          _vehicleId != null ||
          _scheduledAt != null ||
          _reason.text.isNotEmpty ||
          _notes.text.isNotEmpty;
    }
    return _scheduledAt != c.scheduledAt || _reason.text != c.reason || _notes.text != (c.notes ?? '');
  }

  String? _nullIfEmpty(String texto) => texto.trim().isEmpty ? null : texto.trim();

  Future<void> _save({bool confirmDuplicate = false}) async {
    setState(() {
      _serverErrors = <String, String>{};
      _clientTouched = true;
    });
    final bool formOk = _formKey.currentState?.validate() ?? false;
    if (!formOk || _client == null || _vehicleId == null) return;

    setState(() => _saving = true);
    final AppointmentsProvider provider = context.read<AppointmentsProvider>();
    final AppointmentInput input = AppointmentInput(
      clientId: _isEdit ? null : _client!.id,
      vehicleId: _isEdit ? null : _vehicleId,
      scheduledAt: _scheduledAt!,
      reason: _reason.text.trim(),
      notes: _nullIfEmpty(_notes.text),
    );

    try {
      if (_isEdit) {
        await provider.update(_appointment!.id, input, confirmDuplicate: confirmDuplicate);
      } else {
        await provider.create(input, confirmDuplicate: confirmDuplicate);
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        _isEdit ? 'Cita actualizada correctamente.' : 'Cita registrada correctamente.',
      );
      setState(() => _allowPop = true);
      Navigator.of(context).pop(true);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      await _handleError(error);
    }
  }

  Future<void> _handleError(ApiError error) async {
    if (error.code == 'APPOINTMENT_DUPLICATE_WARNING') {
      final dynamic coincidencias = error.detail('matches');
      final String horas = coincidencias is List
          ? coincidencias
              .map((dynamic m) => Format.dateTime((m as Map<String, dynamic>)['scheduledAt'] as String?))
              .join(', ')
          : 'otra hora';
      final bool confirmar = await showConfirmDialog(
        context,
        title: 'Cita coincidente',
        message: 'Este vehículo ya tiene otra cita el mismo día ($horas). '
            '¿Quieres registrar esta cita de todas formas?',
      );
      if (confirmar && mounted) await _save(confirmDuplicate: true);
      return;
    }

    if (error.code == 'VALIDATION_ERROR' && error.details is List) {
      final Map<String, String> campos = <String, String>{};
      for (final dynamic d in error.details as List<dynamic>) {
        if (d is Map && d['field'] != null) {
          campos[d['field'] as String] = d['message'] as String;
        }
      }
      setState(() => _serverErrors = campos);
      return;
    }

    if (error.code == 'NOT_FOUND' && error.detail('field') != null) {
      setState(() => _serverErrors = <String, String>{error.detail('field') as String: error.message});
      return;
    }

    showAppSnackBar(context, error.message, isError: true);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _allowPop || !_dirty,
      onPopInvokedWithResult: (bool didPop, Object? result) async {
        if (didPop) return;
        final bool salir = await showConfirmDialog(
          context,
          title: 'Salir sin guardar',
          message: '¿Seguro que quieres salir? Los cambios sin guardar se perderán.',
        );
        if (salir && context.mounted) {
          setState(() => _allowPop = true);
          Navigator.of(context).pop();
        }
      },
      child: AppShell(
        currentRoute: AppRoutes.appointments,
        title: _isEdit ? 'Editar cita' : 'Nueva cita',
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Align(
            alignment: Alignment.topLeft,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Panel(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Form(
                  key: _formKey,
                  onChanged: () => setState(() {}),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      ClientVehiclePicker(
                        client: _client,
                        vehicleId: _vehicleId,
                        enabled: !_saving,
                        lockClient: _isEdit,
                        lockVehicle: _isEdit,
                        clientError: _serverErrors['clientId'] ??
                            (_clientTouched && _client == null ? 'Selecciona al cliente.' : null),
                        vehicleError: _serverErrors['vehicleId'] ??
                            (_clientTouched && _client != null && _vehicleId == null
                                ? 'Selecciona el vehículo.'
                                : null),
                        onClientChanged: (Client? c) => setState(() => _client = c),
                        onVehicleChanged: (int? id) => setState(() => _vehicleId = id),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      DateTimeFormField(
                        value: _scheduledAt,
                        enabled: !_saving,
                        errorText: _serverErrors['scheduledAt'],
                        onChanged: (String? valor) => setState(() => _scheduledAt = valor),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _reason,
                        enabled: !_saving,
                        decoration: InputDecoration(
                          labelText: 'Motivo *',
                          errorText: _serverErrors['reason'],
                        ),
                        validator: (String? v) =>
                            Validators.required(v, 'el motivo') ?? Validators.maxLength(v, 255),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _notes,
                        enabled: !_saving,
                        minLines: 2,
                        maxLines: 4,
                        decoration: InputDecoration(
                          labelText: 'Observaciones',
                          errorText: _serverErrors['notes'],
                        ),
                        validator: (String? v) => Validators.maxLength(v, 500),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: <Widget>[
                          OutlinedButton(
                            onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                            child: const Text('Cancelar'),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          FilledButton(
                            onPressed: _saving ? null : () => _save(),
                            child: _saving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.onPrimary,
                                    ),
                                  )
                                : const Text('Guardar'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
