import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/client.dart';
import '../../models/vehicle.dart';
import '../../providers/vehicles_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../utils/validators.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/owner_picker.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Argumentos de la ruta del formulario de vehículo.
class VehicleFormArgs {
  const VehicleFormArgs({this.vehicle, this.clientId, this.clientName, this.clientPhone});

  /// Vehículo a editar; si es null se registra uno nuevo.
  final Vehicle? vehicle;

  /// Propietario preseleccionado (por ejemplo, al agregar desde el detalle del cliente).
  final int? clientId;
  final String? clientName;
  final String? clientPhone;
}

/// Formulario de vehículo: alta (con propietario obligatorio) o edición (propietario bloqueado).
class VehicleFormScreen extends StatefulWidget {
  const VehicleFormScreen({super.key, this.args});

  final VehicleFormArgs? args;

  @override
  State<VehicleFormScreen> createState() => _VehicleFormScreenState();
}

class _VehicleFormScreenState extends State<VehicleFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _brand;
  late final TextEditingController _model;
  late final TextEditingController _year;
  late final TextEditingController _plate;
  late final TextEditingController _vin;
  late final TextEditingController _color;
  late final TextEditingController _mileage;

  Client? _owner;
  String? _ownerError;
  bool _ownerTouched = false;
  bool _saving = false;
  bool _allowPop = false;
  Map<String, String> _serverErrors = <String, String>{};

  Vehicle? get _vehicle => widget.args?.vehicle;
  bool get _isEdit => _vehicle != null;

  @override
  void initState() {
    super.initState();
    final Vehicle? v = _vehicle;
    _brand = TextEditingController(text: v?.brand ?? '');
    _model = TextEditingController(text: v?.model ?? '');
    _year = TextEditingController(text: v == null ? '' : '${v.year}');
    _plate = TextEditingController(text: v?.licensePlate ?? '');
    _vin = TextEditingController(text: v?.vin ?? '');
    _color = TextEditingController(text: v?.color ?? '');
    _mileage = TextEditingController(text: v == null ? '' : '${v.currentMileage}');

    if (v != null) {
      _owner = Client(id: v.clientId, name: v.ownerName ?? 'Propietario', phone: v.ownerPhone ?? '');
    } else if (widget.args?.clientId != null) {
      _owner = Client(
        id: widget.args!.clientId!,
        name: widget.args!.clientName ?? 'Propietario',
        phone: widget.args!.clientPhone ?? '',
      );
    }
  }

  @override
  void dispose() {
    for (final TextEditingController c in <TextEditingController>[
      _brand,
      _model,
      _year,
      _plate,
      _vin,
      _color,
      _mileage,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _dirty {
    final Vehicle? v = _vehicle;
    final bool ownerChanged = !_isEdit && _owner?.id != widget.args?.clientId;
    return ownerChanged ||
        _brand.text != (v?.brand ?? '') ||
        _model.text != (v?.model ?? '') ||
        _year.text != (v == null ? '' : '${v.year}') ||
        _plate.text != (v?.licensePlate ?? '') ||
        _vin.text != (v?.vin ?? '') ||
        _color.text != (v?.color ?? '') ||
        _mileage.text != (v == null ? '' : '${v.currentMileage}');
  }

  String? _nullIfEmpty(String texto) => texto.trim().isEmpty ? null : texto.trim();

  Future<void> _save({bool mileageCorrection = false}) async {
    setState(() {
      _serverErrors = <String, String>{};
      _ownerTouched = true;
      _ownerError = _owner == null ? 'Selecciona al propietario del vehículo.' : null;
    });
    final bool formOk = _formKey.currentState?.validate() ?? false;
    if (!formOk || _owner == null) return;

    final VehiclesProvider provider = context.read<VehiclesProvider>();
    final int? mileage = _nullIfEmpty(_mileage.text) == null ? null : int.parse(_mileage.text.trim());

    // Regla de negocio: el kilometraje no baja sin una corrección explícita.
    if (_isEdit && mileage != null && mileage < _vehicle!.currentMileage && !mileageCorrection) {
      final bool confirmar = await _confirmMileageCorrection();
      if (!confirmar || !mounted) return;
      return _save(mileageCorrection: true);
    }

    setState(() => _saving = true);
    final VehicleInput input = VehicleInput(
      clientId: _isEdit ? null : _owner!.id,
      brand: _brand.text.trim(),
      model: _model.text.trim(),
      year: int.parse(_year.text.trim()),
      licensePlate: _plate.text.trim(),
      vin: _nullIfEmpty(_vin.text),
      color: _nullIfEmpty(_color.text),
      currentMileage: mileage,
    );

    try {
      if (_isEdit) {
        await provider.update(_vehicle!.id, input, mileageCorrection: mileageCorrection);
      } else {
        await provider.create(input);
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        _isEdit ? 'Vehículo actualizado correctamente.' : 'Vehículo registrado correctamente.',
      );
      setState(() => _allowPop = true);
      Navigator.of(context).pop(true);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      await _handleError(error);
    }
  }

  Future<bool> _confirmMileageCorrection() {
    return showConfirmDialog(
      context,
      title: 'Kilometraje menor al registrado',
      message: 'El kilometraje que escribiste es menor al registrado '
          '(${Format.mileage(_vehicle!.currentMileage)}). '
          '¿Quieres guardarlo como una corrección?',
    );
  }

  Future<void> _handleError(ApiError error) async {
    switch (error.code) {
      case 'DUPLICATE_LICENSE_PLATE':
        setState(() => _serverErrors = <String, String>{'licensePlate': error.message});
      case 'DUPLICATE_VIN':
        setState(() => _serverErrors = <String, String>{'vin': error.message});
      case 'MILEAGE_DECREASE':
        final bool confirmar = await _confirmMileageCorrection();
        if (confirmar && mounted) await _save(mileageCorrection: true);
      case 'NOT_FOUND' when error.detail('field') == 'clientId':
        setState(() => _ownerError = error.message);
      case 'VALIDATION_ERROR' when error.details is List:
        final Map<String, String> campos = <String, String>{};
        for (final dynamic d in error.details as List<dynamic>) {
          if (d is Map && d['field'] != null) {
            campos[d['field'] as String] = d['message'] as String;
          }
        }
        setState(() {
          _serverErrors = campos;
          if (campos.containsKey('clientId')) _ownerError = campos['clientId'];
        });
      default:
        showAppSnackBar(context, error.message, isError: true);
    }
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
        currentRoute: AppRoutes.vehicles,
        title: _isEdit ? 'Editar vehículo' : 'Nuevo vehículo',
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
                      OwnerPicker(
                        selected: _owner,
                        enabled: !_isEdit && !_saving,
                        errorText: _ownerTouched ? _ownerError : null,
                        onChanged: (Client? c) => setState(() {
                          _owner = c;
                          _ownerError = null;
                        }),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(
                            child: TextFormField(
                              controller: _brand,
                              enabled: !_saving,
                              decoration: InputDecoration(
                                labelText: 'Marca *',
                                errorText: _serverErrors['brand'],
                              ),
                              validator: (String? v) =>
                                  Validators.required(v, 'la marca') ?? Validators.maxLength(v, 60),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: TextFormField(
                              controller: _model,
                              enabled: !_saving,
                              decoration: InputDecoration(
                                labelText: 'Modelo *',
                                errorText: _serverErrors['model'],
                              ),
                              validator: (String? v) =>
                                  Validators.required(v, 'el modelo') ?? Validators.maxLength(v, 60),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(
                            child: TextFormField(
                              controller: _year,
                              enabled: !_saving,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Año *',
                                errorText: _serverErrors['year'],
                              ),
                              validator: Validators.year,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: TextFormField(
                              controller: _plate,
                              enabled: !_saving,
                              textCapitalization: TextCapitalization.characters,
                              decoration: InputDecoration(
                                labelText: 'Placa *',
                                errorText: _serverErrors['licensePlate'],
                              ),
                              validator: Validators.licensePlate,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _vin,
                        enabled: !_saving,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: 'Número de identificación (VIN)',
                          errorText: _serverErrors['vin'],
                        ),
                        validator: Validators.vin,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(
                            child: TextFormField(
                              controller: _color,
                              enabled: !_saving,
                              decoration: InputDecoration(
                                labelText: 'Color',
                                errorText: _serverErrors['color'],
                              ),
                              validator: (String? v) => Validators.maxLength(v, 30),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: TextFormField(
                              controller: _mileage,
                              enabled: !_saving,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Kilometraje actual',
                                errorText: _serverErrors['currentMileage'],
                              ),
                              validator: Validators.mileage,
                            ),
                          ),
                        ],
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
