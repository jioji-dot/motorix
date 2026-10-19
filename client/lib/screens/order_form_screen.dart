import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/appointment.dart';
import '../models/client.dart';
import '../models/service_order.dart';
import '../models/vehicle.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/button_spinner.dart';
import '../widgets/client_vehicle_fields.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

/// Abre el formulario para crear una orden a partir de una cita Confirmada.
Future<void> crearOrdenDesdeCita(BuildContext context, Appointment cita) async {
  await Navigator.of(context).push<ServiceOrder>(
    MaterialPageRoute(builder: (_) => OrderFormScreen(appointment: cita)),
  );
}

const _mensajeKilometraje = 'El kilometraje de entrada debe ser un número entero entre 0 y 1,500,000 km.';

/// Alta de una orden de servicio. Si se abre desde una cita, el cliente y el vehículo vienen de ella.
/// Devuelve la orden creada (o `null` si se cancela).
class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.appointment});

  final Appointment? appointment;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _mileage;
  late final TextEditingController _problem;
  List<Mechanic> _mechanics = [];
  int? _mechanicId;
  int? _clientId;
  int? _vehicleId;
  Vehicle? _vehicle;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final cita = widget.appointment;
    _clientId = cita?.clientId;
    _vehicleId = cita?.vehicleId;
    _mileage = TextEditingController();
    _problem = TextEditingController(text: cita?.reason ?? '');
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMechanics());
  }

  @override
  void dispose() {
    _mileage.dispose();
    _problem.dispose();
    super.dispose();
  }

  bool get _dirty =>
      _mileage.text.isNotEmpty ||
      _problem.text != (widget.appointment?.reason ?? '') ||
      _mechanicId != null ||
      _clientId != widget.appointment?.clientId;

  Future<void> _loadMechanics() async {
    try {
      final mecanicos = await context.read<OrdersProvider>().mechanics();
      if (mounted) setState(() => _mechanics = mecanicos);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Map<String, dynamic> _datos({bool corregirKilometraje = false}) => {
        'clientId': _clientId,
        'vehicleId': _vehicleId,
        'mechanicId': _mechanicId,
        'entryMileage': int.parse(_mileage.text.trim()),
        'reportedProblem': _problem.text.trim(),
        'appointmentId': ?widget.appointment?.id,
        if (corregirKilometraje) 'mileageCorrection': true,
      };

  Future<void> _save({bool corregirKilometraje = false}) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final orden = await context.read<OrdersProvider>().create(_datos(corregirKilometraje: corregirKilometraje));
      if (!mounted) return;
      showFeedback(context, 'Orden ${orden.folio} creada correctamente.');
      Navigator.of(context).pop<ServiceOrder>(orden);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'MILEAGE_DECREASE') {
        setState(() => _saving = false);
        final corregir = await showConfirmDialog(
          context,
          title: 'Corregir kilometraje',
          message: '${e.message}\n\n¿Es una corrección del kilometraje registrado?',
        );
        if (corregir && mounted) await _save(corregirKilometraje: true);
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
          title: Text(cita == null ? 'Nueva orden de servicio' : 'Crear orden desde la cita'),
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
                      locked: cita != null,
                      initialClient: cita == null
                          ? null
                          : Client(id: cita.clientId, name: cita.clientName, phone: cita.clientPhone, active: true),
                      initialVehicleId: cita?.vehicleId,
                      onChanged: (clienteId, vehiculoId) => setState(() {
                        _clientId = clienteId;
                        _vehicleId = vehiculoId;
                      }),
                      onVehicleSelected: (vehiculo) => setState(() => _vehicle = vehiculo),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    DropdownButtonFormField<int>(
                      key: const Key('campo-mecanico'),
                      initialValue: _mechanicId,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Mecánico asignado'),
                      items: [
                        for (final m in _mechanics) DropdownMenuItem(value: m.id, child: Text(m.name)),
                      ],
                      onChanged: (valor) => setState(() => _mechanicId = valor),
                      validator: (v) => v == null ? 'El mecánico es obligatorio.' : null,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-kilometraje-entrada'),
                      controller: _mileage,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Kilometraje de entrada',
                        helperText: _vehicle == null
                            ? null
                            : 'Kilometraje actual del vehículo: ${formatMileage(_vehicle!.currentMileage)}',
                      ),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return 'El kilometraje de entrada es obligatorio.';
                        final km = int.tryParse(t);
                        if (km == null || km < 0 || km > 1500000) return _mensajeKilometraje;
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-problema'),
                      controller: _problem,
                      minLines: 2,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: 'Problema reportado'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return 'El problema reportado es obligatorio.';
                        if (t.length > 2000) return 'El problema reportado no puede tener más de 2000 caracteres.';
                        return null;
                      },
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
                          child: _saving ? const ButtonSpinner() : const Text('Crear orden'),
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
