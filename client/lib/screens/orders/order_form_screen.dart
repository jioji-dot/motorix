import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/appointment.dart';
import '../../models/client.dart';
import '../../models/service_order.dart';
import '../../providers/orders_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../utils/validators.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/client_vehicle_picker.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Argumentos de la ruta del formulario de orden.
class OrderFormArgs {
  const OrderFormArgs({this.order, this.appointment});

  /// Orden a corregir; si es null se crea una nueva.
  final ServiceOrder? order;

  /// Cita desde la que se crea la orden (precarga cliente, vehículo y motivo).
  final Appointment? appointment;
}

/// Formulario de orden de servicio: alta (desde cero o desde una cita) o corrección.
/// Al guardar devuelve (con `pop`) el identificador de la orden.
class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.args});

  final OrderFormArgs? args;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _mileage;
  late final TextEditingController _problem;

  Client? _client;
  int? _vehicleId;
  int? _mechanicId;
  List<MechanicOption> _mechanics = <MechanicOption>[];
  String? _mechanicsError;
  bool _clientTouched = false;
  bool _saving = false;
  bool _allowPop = false;
  Map<String, String> _serverErrors = <String, String>{};

  ServiceOrder? get _order => widget.args?.order;
  Appointment? get _appointment => widget.args?.appointment;
  bool get _isEdit => _order != null;

  @override
  void initState() {
    super.initState();
    final ServiceOrder? o = _order;
    final Appointment? c = _appointment;
    _mileage = TextEditingController(text: o == null ? '' : '${o.entryMileage}');
    _problem = TextEditingController(text: o?.reportedProblem ?? c?.reason ?? '');
    if (o != null) {
      _client = Client(id: o.clientId, name: o.clientName, phone: '');
      _vehicleId = o.vehicleId;
    } else if (c != null) {
      _client = Client(id: c.clientId, name: c.clientName, phone: '');
      _vehicleId = c.vehicleId;
    }
    _mechanicId = o?.mechanicId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMechanics());
  }

  Future<void> _loadMechanics() async {
    try {
      final List<MechanicOption> lista = await context.read<OrdersProvider>().mechanics();
      if (mounted) setState(() => _mechanics = lista);
    } catch (_) {
      if (mounted) setState(() => _mechanicsError = 'No se pudo cargar la lista de mecánicos.');
    }
  }

  String _mechanicName(int? id) {
    for (final MechanicOption m in _mechanics) {
      if (m.id == id) return m.name;
    }
    return 'el mecánico';
  }

  @override
  void dispose() {
    _mileage.dispose();
    _problem.dispose();
    super.dispose();
  }

  bool get _dirty {
    final ServiceOrder? o = _order;
    if (o != null) {
      return _mileage.text != '${o.entryMileage}' ||
          _problem.text != o.reportedProblem ||
          _mechanicId != o.mechanicId;
    }
    final Appointment? c = _appointment;
    if (c != null) {
      return _mileage.text.isNotEmpty || _problem.text != c.reason || _mechanicId != null;
    }
    return _client != null ||
        _vehicleId != null ||
        _mechanicId != null ||
        _mileage.text.isNotEmpty ||
        _problem.text.isNotEmpty;
  }

  Future<bool> _confirmMileageCorrection() => showConfirmDialog(
        context,
        title: 'Kilometraje menor al registrado',
        message: 'El kilometraje de entrada es menor al que tiene registrado el vehículo. '
            '¿Quieres guardarlo como una corrección?',
      );

  Future<void> _save({bool mileageCorrection = false}) async {
    setState(() {
      _serverErrors = <String, String>{};
      _clientTouched = true;
    });
    final bool formOk = _formKey.currentState?.validate() ?? false;
    if (!formOk || _client == null || _vehicleId == null) return;

    final ServiceOrder? original = _order;
    // Reasignar a otro mecánico pide confirmación (design-system 8.5).
    if (original != null &&
        original.mechanicId != null &&
        _mechanicId != original.mechanicId &&
        !mileageCorrection) {
      final String destino = _mechanicId == null ? 'sin mecánico' : _mechanicName(_mechanicId);
      final bool confirmar = await showConfirmDialog(
        context,
        title: 'Reasignar orden',
        message: '¿Seguro que quieres reasignar la orden ${original.folio} '
            'de ${original.mechanicName ?? 'su mecánico'} a $destino?',
      );
      if (!confirmar || !mounted) return;
    }

    setState(() => _saving = true);
    final OrdersProvider provider = context.read<OrdersProvider>();
    final int kilometraje = int.parse(_mileage.text.trim());

    try {
      final ServiceOrder resultado;
      if (original != null) {
        final bool cambioMecanico = _mechanicId != original.mechanicId;
        resultado = await provider.updateBasics(
          original.id,
          OrderBasicsChanges(
            reportedProblem:
                _problem.text.trim() != original.reportedProblem ? _problem.text.trim() : null,
            mechanicId: cambioMecanico ? _mechanicId : null,
            clearMechanic: cambioMecanico && _mechanicId == null,
            entryMileage: kilometraje != original.entryMileage ? kilometraje : null,
            mileageCorrection: mileageCorrection,
          ),
        );
      } else {
        resultado = await provider.create(
          NewOrderInput(
            appointmentId: _appointment?.id,
            clientId: _appointment == null ? _client!.id : null,
            vehicleId: _appointment == null ? _vehicleId : null,
            entryMileage: kilometraje,
            reportedProblem: _problem.text.trim(),
            mechanicId: _mechanicId,
            mileageCorrection: mileageCorrection,
          ),
        );
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        original != null
            ? 'Orden ${resultado.folio} actualizada correctamente.'
            : 'Orden ${resultado.folio} registrada correctamente.',
      );
      setState(() => _allowPop = true);
      Navigator.of(context).pop(resultado.id);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      await _handleError(error);
    }
  }

  Future<void> _handleError(ApiError error) async {
    if (error.code == 'MILEAGE_DECREASE') {
      final bool confirmar = await _confirmMileageCorrection();
      if (confirmar && mounted) await _save(mileageCorrection: true);
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

    if ((error.code == 'NOT_FOUND' || error.code == 'APPOINTMENT_NOT_AVAILABLE') &&
        error.detail('field') != null) {
      setState(() => _serverErrors = <String, String>{error.detail('field') as String: error.message});
      return;
    }

    showAppSnackBar(context, error.message, isError: true);
  }

  @override
  Widget build(BuildContext context) {
    final Appointment? cita = _appointment;
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
        currentRoute: AppRoutes.orders,
        title: _isEdit ? 'Corregir orden ${_order!.folio}' : 'Nueva orden',
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
                      if (cita != null) ...<Widget>[
                        Text(
                          'Desde la cita del ${Format.dateTime(cita.scheduledAt)}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                      ClientVehiclePicker(
                        client: _client,
                        vehicleId: _vehicleId,
                        enabled: !_saving,
                        lockClient: cita != null || _isEdit,
                        lockVehicle: cita != null || _isEdit,
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
                      TextFormField(
                        controller: _mileage,
                        enabled: !_saving,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Kilometraje de entrada *',
                          errorText: _serverErrors['entryMileage'],
                        ),
                        validator: (String? v) =>
                            Validators.required(v, 'el kilometraje de entrada') ?? Validators.mileage(v),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      DropdownButtonFormField<int?>(
                        key: ValueKey<String>('mecanico-${_mechanics.length}-$_mechanicId'),
                        initialValue: _mechanics.any((MechanicOption m) => m.id == _mechanicId)
                            ? _mechanicId
                            : null,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: 'Mecánico',
                          helperText: _mechanicsError ?? 'Puedes asignarlo ahora o después.',
                          errorText: _serverErrors['mechanicId'],
                        ),
                        items: <DropdownMenuItem<int?>>[
                          const DropdownMenuItem<int?>(value: null, child: Text('Sin asignar')),
                          for (final MechanicOption m in _mechanics)
                            DropdownMenuItem<int?>(value: m.id, child: Text(m.name)),
                        ],
                        onChanged: _saving ? null : (int? id) => setState(() => _mechanicId = id),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _problem,
                        enabled: !_saving,
                        minLines: 3,
                        maxLines: 5,
                        decoration: InputDecoration(
                          labelText: 'Problema reportado *',
                          errorText: _serverErrors['reportedProblem'],
                        ),
                        validator: (String? v) =>
                            Validators.required(v, 'el problema reportado') ??
                            ((v ?? '').trim().length > 1000
                                ? 'El problema reportado admite máximo 1000 caracteres.'
                                : null),
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
                                : Text(_isEdit ? 'Guardar' : 'Crear orden'),
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
