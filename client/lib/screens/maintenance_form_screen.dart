import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/maintenance.dart';
import '../providers/maintenance_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/button_spinner.dart';
import '../widgets/client_vehicle_fields.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

const int _kmMaximo = 1500000;

/// Texto 'AAAA-MM-DD' de una fecha.
String isoDate(DateTime fecha) {
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${fecha.year}-${dos(fecha.month)}-${dos(fecha.day)}';
}

DateTime? _leerFecha(String texto) {
  final t = texto.trim();
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(t)) return null;
  final fecha = DateTime.tryParse(t);
  // DateTime.tryParse acepta fechas como 2026-02-31 corrigiéndolas: se rechaza si cambió el día.
  if (fecha == null || isoDate(fecha) != t) return null;
  return fecha;
}

/// Datos con los que se precarga el formulario cuando se programa desde una orden terminada o entregada.
class MaintenancePreset {
  const MaintenancePreset({
    required this.vehicleId,
    required this.vehicleLabel,
    required this.lastServiceDate,
    required this.lastMileage,
    this.sourceOrderId,
  });

  final int vehicleId;
  final String vehicleLabel;
  final DateTime lastServiceDate;
  final int lastMileage;
  final int? sourceOrderId;
}

/// Alta y edición de un mantenimiento programado. Devuelve `true` al guardar.
class MaintenanceFormScreen extends StatefulWidget {
  const MaintenanceFormScreen({super.key, this.maintenance, this.preset});

  /// Si se indica, el formulario edita ese mantenimiento (el vehículo no se cambia).
  final Maintenance? maintenance;

  /// Vehículo y datos del último servicio ya conocidos (desde el detalle de una orden).
  final MaintenancePreset? preset;

  @override
  State<MaintenanceFormScreen> createState() => _MaintenanceFormScreenState();
}

class _MaintenanceFormScreenState extends State<MaintenanceFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _serviceType;
  late final TextEditingController _lastDate;
  late final TextEditingController _lastMileage;
  late final TextEditingController _nextDate;
  late final TextEditingController _nextMileage;
  late final TextEditingController _notes;
  int? _vehicleId;
  bool _saving = false;
  String? _error;

  bool get _editing => widget.maintenance != null;

  /// El vehículo viene fijo al editar o al programar desde una orden.
  String? get _vehicleFijo => widget.maintenance == null
      ? widget.preset?.vehicleLabel
      : '${widget.maintenance!.vehicleTitle} · ${widget.maintenance!.licensePlate}';

  @override
  void initState() {
    super.initState();
    final m = widget.maintenance;
    final p = widget.preset;
    _vehicleId = m?.vehicleId ?? p?.vehicleId;
    _serviceType = TextEditingController(text: m?.serviceType ?? '');
    _lastDate = TextEditingController(text: m != null ? isoDate(m.lastServiceDate) : (p != null ? isoDate(p.lastServiceDate) : ''));
    _lastMileage = TextEditingController(text: m?.lastMileage.toString() ?? p?.lastMileage.toString() ?? '');
    _nextDate = TextEditingController(text: m?.nextDate != null ? isoDate(m!.nextDate!) : '');
    _nextMileage = TextEditingController(text: m?.nextMileage?.toString() ?? '');
    _notes = TextEditingController(text: m?.notes ?? '');
  }

  @override
  void dispose() {
    for (final c in [_serviceType, _lastDate, _lastMileage, _nextDate, _nextMileage, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _dirty {
    final m = widget.maintenance;
    final p = widget.preset;
    return _serviceType.text != (m?.serviceType ?? '') ||
        _lastDate.text != (m != null ? isoDate(m.lastServiceDate) : (p != null ? isoDate(p.lastServiceDate) : '')) ||
        _lastMileage.text != (m?.lastMileage.toString() ?? p?.lastMileage.toString() ?? '') ||
        _nextDate.text != (m?.nextDate != null ? isoDate(m!.nextDate!) : '') ||
        _nextMileage.text != (m?.nextMileage?.toString() ?? '') ||
        _notes.text != (m?.notes ?? '') ||
        (!_editing && widget.preset == null && _vehicleId != null);
  }

  Future<void> _pickDate(TextEditingController controlador) async {
    final inicial = _leerFecha(controlador.text) ?? DateTime.now();
    final elegida = await showDatePicker(
      context: context,
      initialDate: inicial,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (elegida != null) setState(() => controlador.text = isoDate(elegida));
  }

  String? _validarFecha(String? valor, {required bool obligatoria, required String etiqueta}) {
    final t = (valor ?? '').trim();
    if (t.isEmpty) return obligatoria ? '$etiqueta es obligatoria.' : null;
    if (_leerFecha(t) == null) return '$etiqueta debe tener el formato AAAA-MM-DD.';
    return null;
  }

  String? _validarKilometraje(String? valor, {required bool obligatorio, required String etiqueta}) {
    final t = (valor ?? '').trim();
    if (t.isEmpty) return obligatorio ? '$etiqueta es obligatorio.' : null;
    final numero = int.tryParse(t);
    if (numero == null || numero < 0 || numero > _kmMaximo) {
      return '$etiqueta debe ser un número entero entre 0 y 1,500,000 km.';
    }
    return null;
  }

  /// Reglas cruzadas del servidor, para avisar antes de enviar.
  String? _validarProxima() {
    final fecha = _nextDate.text.trim();
    final km = _nextMileage.text.trim();
    if (fecha.isEmpty && km.isEmpty) return 'Indica la próxima fecha, el próximo kilometraje o ambos.';
    return null;
  }

  Map<String, dynamic> _datos() {
    final fecha = _nextDate.text.trim();
    final km = _nextMileage.text.trim();
    return {
      if (!_editing) 'vehicleId': _vehicleId,
      'serviceType': _serviceType.text.trim(),
      'lastServiceDate': _lastDate.text.trim(),
      'lastMileage': int.parse(_lastMileage.text.trim()),
      'nextDate': fecha.isEmpty ? null : fecha,
      'nextMileage': km.isEmpty ? null : int.parse(km),
      'notes': _notes.text.trim(),
      if (!_editing && widget.preset?.sourceOrderId != null) 'sourceOrderId': widget.preset!.sourceOrderId,
    };
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final problema = _validarProxima();
    if (problema != null) {
      setState(() => _error = problema);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final provider = context.read<MaintenanceProvider>();
    try {
      if (_editing) {
        await provider.update(widget.maintenance!.id, _datos());
      } else {
        await provider.create(_datos());
      }
      if (!mounted) return;
      showFeedback(context, _editing ? 'Mantenimiento actualizado correctamente.' : 'Mantenimiento programado correctamente.');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.details.isNotEmpty ? e.details.first['message'] as String : e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final fijo = _vehicleFijo;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final salir = await confirmDiscardChanges(context);
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Editar mantenimiento' : 'Programar mantenimiento'),
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
                    if (fijo != null)
                      InputDecorator(
                        key: const Key('vehiculo-fijo'),
                        decoration: const InputDecoration(labelText: 'Vehículo'),
                        child: Text(fijo, overflow: TextOverflow.ellipsis),
                      )
                    else
                      ClientVehicleFields(onChanged: (_, vehicleId) => setState(() => _vehicleId = vehicleId)),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-tipo-servicio'),
                      controller: _serviceType,
                      decoration: const InputDecoration(labelText: 'Tipo de servicio (por ejemplo, Cambio de aceite)'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return 'El tipo de servicio es obligatorio.';
                        if (t.length > 100) return 'El tipo de servicio no puede tener más de 100 caracteres.';
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-fecha-ultimo'),
                            controller: _lastDate,
                            decoration: InputDecoration(
                              labelText: 'Fecha del último servicio',
                              hintText: 'AAAA-MM-DD',
                              suffixIcon: IconButton(
                                tooltip: 'Elegir fecha',
                                icon: const Icon(LucideIcons.calendar, size: 18),
                                onPressed: () => _pickDate(_lastDate),
                              ),
                            ),
                            validator: (v) => _validarFecha(v, obligatoria: true, etiqueta: 'La fecha del último servicio'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-km-ultimo'),
                            controller: _lastMileage,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Kilometraje del último servicio'),
                            validator: (v) =>
                                _validarKilometraje(v, obligatorio: true, etiqueta: 'El kilometraje del último servicio'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text('Próximo mantenimiento (indica la fecha, el kilometraje o ambos)', style: texto.bodySmall),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-proxima-fecha'),
                            controller: _nextDate,
                            decoration: InputDecoration(
                              labelText: 'Próxima fecha',
                              hintText: 'AAAA-MM-DD',
                              suffixIcon: IconButton(
                                tooltip: 'Elegir próxima fecha',
                                icon: const Icon(LucideIcons.calendar, size: 18),
                                onPressed: () => _pickDate(_nextDate),
                              ),
                            ),
                            validator: (v) {
                              final problema = _validarFecha(v, obligatoria: false, etiqueta: 'La próxima fecha');
                              if (problema != null) return problema;
                              final fecha = _leerFecha(v ?? '');
                              final ultimo = _leerFecha(_lastDate.text);
                              if (fecha != null && ultimo != null && fecha.isBefore(ultimo)) {
                                return 'La próxima fecha no puede ser anterior a la del último servicio.';
                              }
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-proximo-km'),
                            controller: _nextMileage,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Próximo kilometraje'),
                            validator: (v) {
                              final problema = _validarKilometraje(v, obligatorio: false, etiqueta: 'El próximo kilometraje');
                              if (problema != null) return problema;
                              final proximo = int.tryParse((v ?? '').trim());
                              final ultimo = int.tryParse(_lastMileage.text.trim());
                              if (proximo != null && ultimo != null && proximo <= ultimo) {
                                return 'El próximo kilometraje debe ser mayor al del último servicio (${formatMileage(ultimo)}).';
                              }
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-notas'),
                      controller: _notes,
                      minLines: 2,
                      maxLines: 5,
                      maxLength: 2000,
                      decoration: const InputDecoration(labelText: 'Notas (opcional)', counterText: ''),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(_error!, key: const Key('error-formulario'), style: texto.bodyMedium?.copyWith(color: AppColors.danger)),
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
                          onPressed: _saving ? null : _save,
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
