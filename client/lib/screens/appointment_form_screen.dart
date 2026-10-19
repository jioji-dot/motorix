import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/appointment.dart';
import '../models/client.dart';
import '../providers/appointments_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/button_spinner.dart';
import '../widgets/client_vehicle_fields.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

/// Alta y edición de una cita. Devuelve `true` al guardar. Al editar, el cliente y el vehículo no cambian.
class AppointmentFormScreen extends StatefulWidget {
  const AppointmentFormScreen({super.key, this.appointment});

  final Appointment? appointment;

  @override
  State<AppointmentFormScreen> createState() => _AppointmentFormScreenState();
}

class _AppointmentFormScreenState extends State<AppointmentFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _reason;
  late final TextEditingController _notes;
  late DateTime _date;
  late TimeOfDay _time;
  int? _clientId;
  int? _vehicleId;
  bool _saving = false;
  String? _error;

  bool get _editing => widget.appointment != null;

  late final DateTime _initialDate;
  late final TimeOfDay _initialTime;

  @override
  void initState() {
    super.initState();
    final cita = widget.appointment;
    final manana = DateTime.now().add(const Duration(days: 1));
    _date = cita == null ? DateTime(manana.year, manana.month, manana.day) : DateUtils.dateOnly(cita.scheduledAt);
    _time = cita == null ? const TimeOfDay(hour: 9, minute: 0) : TimeOfDay.fromDateTime(cita.scheduledAt);
    _initialDate = _date;
    _initialTime = _time;
    _clientId = cita?.clientId;
    _vehicleId = cita?.vehicleId;
    _reason = TextEditingController(text: cita?.reason ?? '');
    _notes = TextEditingController(text: cita?.notes ?? '');
  }

  @override
  void dispose() {
    _reason.dispose();
    _notes.dispose();
    super.dispose();
  }

  bool get _dirty {
    final cita = widget.appointment;
    return _reason.text != (cita?.reason ?? '') ||
        _notes.text != (cita?.notes ?? '') ||
        _clientId != cita?.clientId ||
        _vehicleId != cita?.vehicleId ||
        _date != _initialDate ||
        _time != _initialTime;
  }

  String get _scheduledAt {
    String dos(int n) => n.toString().padLeft(2, '0');
    return '${_date.year.toString().padLeft(4, '0')}-${dos(_date.month)}-${dos(_date.day)}T${dos(_time.hour)}:${dos(_time.minute)}';
  }

  Future<void> _pickDate() async {
    final hoy = DateUtils.dateOnly(DateTime.now());
    final elegida = await showDatePicker(
      context: context,
      initialDate: _date.isBefore(hoy) ? hoy : _date,
      firstDate: hoy,
      lastDate: hoy.add(const Duration(days: 730)),
    );
    if (elegida != null) setState(() => _date = elegida);
  }

  Future<void> _pickTime() async {
    final elegida = await showTimePicker(context: context, initialTime: _time);
    if (elegida != null) setState(() => _time = elegida);
  }

  Map<String, dynamic> _datos({bool confirmarDuplicada = false}) => {
        if (!_editing) 'clientId': _clientId,
        if (!_editing) 'vehicleId': _vehicleId,
        'scheduledAt': _scheduledAt,
        'reason': _reason.text.trim(),
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        if (confirmarDuplicada) 'confirmDuplicate': true,
      };

  Future<void> _save({bool confirmarDuplicada = false}) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final provider = context.read<AppointmentsProvider>();
    try {
      if (_editing) {
        await provider.update(widget.appointment!.id, _datos(confirmarDuplicada: confirmarDuplicada));
      } else {
        await provider.create(_datos(confirmarDuplicada: confirmarDuplicada));
      }
      if (!mounted) return;
      showFeedback(context, _editing ? 'Cita actualizada correctamente.' : 'Cita registrada correctamente.');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'DUPLICATE_APPOINTMENT') {
        setState(() => _saving = false);
        final continuar = await showConfirmDialog(
          context,
          title: 'Cita duplicada',
          message: 'Este vehículo ya tiene una cita activa a esa misma fecha y hora. ¿Quieres guardarla de todos modos?',
        );
        if (continuar && mounted) await _save(confirmarDuplicada: true);
        return;
      }
      final detalle = e.details.isNotEmpty ? e.details.map((d) => d['message']).join(' ') : e.message;
      setState(() => _error = detalle);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final cita = widget.appointment;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final salir = await confirmDiscardChanges(context);
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Editar cita' : 'Registrar cita'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: Align(
          alignment: Alignment.topCenter,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Form(
                key: _formKey,
                onChanged: () => setState(() {}),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ClientVehicleFields(
                      locked: _editing,
                      initialClient: cita == null
                          ? null
                          : Client(id: cita.clientId, name: cita.clientName, phone: cita.clientPhone, active: true),
                      initialVehicleId: cita?.vehicleId,
                      onChanged: (clienteId, vehiculoId) => setState(() {
                        _clientId = clienteId;
                        _vehicleId = vehiculoId;
                      }),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: InkWell(
                            key: const Key('campo-fecha'),
                            borderRadius: BorderRadius.circular(AppRadius.control),
                            onTap: _pickDate,
                            child: InputDecorator(
                              decoration: const InputDecoration(
                                labelText: 'Fecha',
                                suffixIcon: Icon(LucideIcons.calendarDays, size: 18),
                              ),
                              child: Text(formatDate(_date)),
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: InkWell(
                            key: const Key('campo-hora'),
                            borderRadius: BorderRadius.circular(AppRadius.control),
                            onTap: _pickTime,
                            child: InputDecorator(
                              decoration: const InputDecoration(
                                labelText: 'Hora',
                                suffixIcon: Icon(LucideIcons.clock, size: 18),
                              ),
                              child: Text(_time.format(context)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-motivo'),
                      controller: _reason,
                      decoration: const InputDecoration(labelText: 'Motivo de la cita'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return 'El motivo es obligatorio.';
                        if (t.length > 255) return 'El motivo no puede tener más de 255 caracteres.';
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-observaciones'),
                      controller: _notes,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'Observaciones (opcional)'),
                      validator: (v) =>
                          (v ?? '').trim().length > 2000 ? 'Las observaciones no pueden tener más de 2000 caracteres.' : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(_error!, style: texto.bodyMedium?.copyWith(color: AppColors.danger)),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton(
                          onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                          child: const Text('Cancelar'),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        FilledButton(
                          onPressed: _saving ? null : () => _save(),
                          child: _saving ? const ButtonSpinner() : const Text('Guardar'),
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
    );
  }
}
