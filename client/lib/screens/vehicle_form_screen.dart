import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../models/vehicle.dart';
import '../providers/clients_provider.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/button_spinner.dart';
import '../utils/format.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

/// Abre el formulario para registrar un vehículo de [client] (desde su detalle).
Future<void> registerVehicleForClient(BuildContext context, Client client) async {
  await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => VehicleFormScreen(presetClient: client)),
  );
}

/// Alta y edición de un vehículo. Un vehículo siempre pertenece a un cliente. Devuelve `true` al guardar.
class VehicleFormScreen extends StatefulWidget {
  const VehicleFormScreen({super.key, this.vehicle, this.presetClient});

  /// Si se indica, el formulario edita ese vehículo (el propietario no se cambia).
  final Vehicle? vehicle;

  /// Propietario ya elegido (cuando se registra desde el detalle de un cliente).
  final Client? presetClient;

  @override
  State<VehicleFormScreen> createState() => _VehicleFormScreenState();
}

class _VehicleFormScreenState extends State<VehicleFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _owner;
  late final TextEditingController _brand;
  late final TextEditingController _model;
  late final TextEditingController _year;
  late final TextEditingController _plate;
  late final TextEditingController _vin;
  late final TextEditingController _mileage;
  int? _clientId;
  bool _saving = false;
  String? _error;

  bool get _editing => widget.vehicle != null;

  @override
  void initState() {
    super.initState();
    final v = widget.vehicle;
    _clientId = v?.clientId ?? widget.presetClient?.id;
    _owner = TextEditingController(text: v?.clientName ?? widget.presetClient?.name ?? '');
    _brand = TextEditingController(text: v?.brand ?? '');
    _model = TextEditingController(text: v?.model ?? '');
    _year = TextEditingController(text: v?.year.toString() ?? '');
    _plate = TextEditingController(text: v?.licensePlate ?? '');
    _vin = TextEditingController(text: v?.vin ?? '');
    _mileage = TextEditingController(text: v?.currentMileage.toString() ?? '');
  }

  @override
  void dispose() {
    for (final c in [_owner, _brand, _model, _year, _plate, _vin, _mileage]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _dirty {
    final v = widget.vehicle;
    return _clientId != (v?.clientId ?? widget.presetClient?.id) ||
        _brand.text != (v?.brand ?? '') ||
        _model.text != (v?.model ?? '') ||
        _year.text != (v?.year.toString() ?? '') ||
        _plate.text != (v?.licensePlate ?? '') ||
        _vin.text != (v?.vin ?? '') ||
        _mileage.text != (v?.currentMileage.toString() ?? '');
  }

  Future<void> _pickOwner() async {
    final cliente = await showDialog<Client>(
      context: context,
      builder: (_) => _OwnerPickerDialog(provider: context.read<ClientsProvider>()),
    );
    if (cliente != null) {
      setState(() {
        _clientId = cliente.id;
        _owner.text = cliente.name;
      });
    }
  }

  Map<String, dynamic> _datos({bool corregirKilometraje = false}) => {
        if (!_editing) 'clientId': _clientId,
        'brand': _brand.text.trim(),
        'model': _model.text.trim(),
        'year': int.parse(_year.text.trim()),
        'licensePlate': _plate.text.replaceAll(RegExp(r'\s+'), '').toUpperCase(),
        'vin': _vin.text.trim().isEmpty ? null : _vin.text.trim().toUpperCase(),
        'currentMileage': int.parse(_mileage.text.trim()),
        if (corregirKilometraje) 'mileageCorrection': true,
      };

  Future<void> _save({bool corregirKilometraje = false}) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final provider = context.read<VehiclesProvider>();
    try {
      if (_editing) {
        await provider.update(widget.vehicle!.id, _datos(corregirKilometraje: corregirKilometraje));
      } else {
        await provider.create(_datos());
      }
      if (!mounted) return;
      showFeedback(context, _editing ? 'Vehículo actualizado correctamente.' : 'Vehículo registrado correctamente.');
      Navigator.of(context).pop(true);
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
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String? _validarAnio(String? valor) {
    final anio = int.tryParse((valor ?? '').trim());
    if (anio == null) return 'El año no es válido.';
    if (anio < 1950) return 'El año debe ser 1950 o posterior.';
    final maximo = DateTime.now().year + 1;
    if (anio > maximo) return 'El año no puede ser mayor a $maximo.';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final salir = await confirmDiscardChanges(context);
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Editar vehículo' : 'Registrar vehículo'),
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
                    TextFormField(
                      key: const Key('campo-propietario'),
                      controller: _owner,
                      readOnly: true,
                      enabled: !_editing && widget.presetClient == null,
                      onTap: _pickOwner,
                      decoration: InputDecoration(
                        labelText: 'Propietario',
                        suffixIcon: (_editing || widget.presetClient != null)
                            ? null
                            : const Icon(LucideIcons.search, size: 18),
                      ),
                      validator: (_) => _clientId == null ? 'El propietario es obligatorio.' : null,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-marca'),
                            controller: _brand,
                            decoration: const InputDecoration(labelText: 'Marca'),
                            validator: (v) {
                              final t = (v ?? '').trim();
                              if (t.isEmpty) return 'La marca es obligatoria.';
                              if (t.length > 60) return 'La marca no puede tener más de 60 caracteres.';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-modelo'),
                            controller: _model,
                            decoration: const InputDecoration(labelText: 'Modelo'),
                            validator: (v) {
                              final t = (v ?? '').trim();
                              if (t.isEmpty) return 'El modelo es obligatorio.';
                              if (t.length > 60) return 'El modelo no puede tener más de 60 caracteres.';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-anio'),
                            controller: _year,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Año'),
                            validator: _validarAnio,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-placas'),
                            controller: _plate,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(labelText: 'Placas'),
                            validator: (v) {
                              final t = (v ?? '').replaceAll(RegExp(r'\s+'), '').toUpperCase();
                              if (t.isEmpty) return 'Las placas son obligatorias.';
                              if (t.length > 15) return 'Las placas no pueden tener más de 15 caracteres.';
                              if (!RegExp(r'^[A-Z0-9-]+$').hasMatch(t)) {
                                return 'Las placas solo pueden tener letras, números y guiones.';
                              }
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-vin'),
                      controller: _vin,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(labelText: 'Número de serie (VIN, opcional)'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return null;
                        return RegExp(r'^[A-Za-z0-9]{17}$').hasMatch(t)
                            ? null
                            : 'El número de serie debe tener 17 caracteres alfanuméricos.';
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-kilometraje'),
                      controller: _mileage,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Kilometraje actual',
                        helperText: _editing ? 'Actual: ${formatMileage(widget.vehicle!.currentMileage)}' : null,
                      ),
                      validator: (v) => RegExp(r'^\d+$').hasMatch((v ?? '').trim())
                          ? null
                          : 'El kilometraje debe ser un número entero mayor o igual a 0.',
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
                          child: _saving
                              ? const ButtonSpinner()
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
    );
  }
}

/// Diálogo para buscar y elegir el propietario entre los clientes activos.
class _OwnerPickerDialog extends StatefulWidget {
  const _OwnerPickerDialog({required this.provider});

  final ClientsProvider provider;

  @override
  State<_OwnerPickerDialog> createState() => _OwnerPickerDialogState();
}

class _OwnerPickerDialogState extends State<_OwnerPickerDialog> {
  Timer? _debounce;
  List<Client> _results = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _search(String texto) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resultados = await widget.provider.searchClients(texto);
      if (mounted) setState(() => _results = resultados);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Elegir propietario'),
      content: SizedBox(
        width: 460,
        height: 360,
        child: Column(
          children: [
            TextField(
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Buscar cliente por nombre',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
              onChanged: (valor) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), () => _search(valor));
              },
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: _loading
                  ? const LoadingState()
                  : _error != null
                      ? ErrorState(message: _error!, onRetry: () => _search(''))
                      : _results.isEmpty
                          ? const EmptyState(title: 'No se encontraron clientes', icon: LucideIcons.users)
                          : ListView.separated(
                              itemCount: _results.length,
                              separatorBuilder: (_, _) => const Divider(),
                              itemBuilder: (_, i) => ListTile(
                                title: Text(_results[i].name),
                                subtitle: Text(formatPhone(_results[i].phone)),
                                onTap: () => Navigator.of(context).pop(_results[i]),
                              ),
                            ),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
      ],
    );
  }
}
