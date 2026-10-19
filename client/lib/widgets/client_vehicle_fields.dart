import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../models/vehicle.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import 'client_picker.dart';

/// Par de campos "Cliente" y "Vehículo del cliente" para los formularios de citas y órdenes.
/// El vehículo siempre se elige entre los del cliente seleccionado.
class ClientVehicleFields extends StatefulWidget {
  const ClientVehicleFields({
    super.key,
    required this.onChanged,
    this.onVehicleSelected,
    this.initialClient,
    this.initialVehicleId,
    this.locked = false,
  });

  final Client? initialClient;
  final int? initialVehicleId;

  /// Si es `true` no se puede cambiar el cliente ni el vehículo (por ejemplo al crear desde una cita).
  final bool locked;

  /// Se invoca cada vez que cambia el cliente o el vehículo elegidos.
  final void Function(int? clientId, int? vehicleId) onChanged;

  /// Se invoca con el vehículo elegido (o `null`), por ejemplo para mostrar su kilometraje actual.
  final void Function(Vehicle? vehicle)? onVehicleSelected;

  @override
  State<ClientVehicleFields> createState() => _ClientVehicleFieldsState();
}

class _ClientVehicleFieldsState extends State<ClientVehicleFields> {
  late final TextEditingController _clientText;
  Client? _client;
  int? _vehicleId;
  List<Vehicle> _vehicles = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _client = widget.initialClient;
    _vehicleId = widget.initialVehicleId;
    _clientText = TextEditingController(text: _client?.name ?? '');
    if (_client != null) WidgetsBinding.instance.addPostFrameCallback((_) => _loadVehicles());
  }

  @override
  void dispose() {
    _clientText.dispose();
    super.dispose();
  }

  Future<void> _pickClient() async {
    final elegido = await showClientPicker(context);
    if (elegido == null || !mounted) return;
    setState(() {
      _client = elegido;
      _clientText.text = elegido.name;
      _vehicleId = null;
      _vehicles = [];
    });
    _notificar();
    await _loadVehicles();
  }

  Vehicle? get _selectedVehicle {
    for (final v in _vehicles) {
      if (v.id == _vehicleId) return v;
    }
    return null;
  }

  void _notificar() {
    widget.onChanged(_client?.id, _vehicleId);
    widget.onVehicleSelected?.call(_selectedVehicle);
  }

  Future<void> _loadVehicles() async {
    final cliente = _client;
    if (cliente == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final vehiculos = await context.read<VehiclesProvider>().forClient(cliente.id);
      if (!mounted) return;
      setState(() {
        _vehicles = vehiculos;
        // Con un solo vehículo se preselecciona; si el elegido ya no existe, se limpia.
        if (_vehicleId != null && !vehiculos.any((v) => v.id == _vehicleId)) _vehicleId = null;
        if (_vehicleId == null && vehiculos.length == 1) _vehicleId = vehiculos.first.id;
      });
      _notificar();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          key: const Key('campo-cliente'),
          controller: _clientText,
          readOnly: true,
          enabled: !widget.locked,
          onTap: _pickClient,
          decoration: InputDecoration(
            labelText: 'Cliente',
            suffixIcon: widget.locked ? null : const Icon(LucideIcons.search, size: 18),
          ),
          validator: (_) => _client == null ? 'El cliente es obligatorio.' : null,
        ),
        const SizedBox(height: AppSpacing.lg),
        DropdownButtonFormField<int>(
          key: ValueKey('campo-vehiculo-${_client?.id}-${_vehicles.length}'),
          initialValue: _vehicleId,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: 'Vehículo del cliente',
            helperText: _client == null
                ? 'Elige primero al cliente'
                : (_vehicles.isEmpty && !_loading ? 'Este cliente no tiene vehículos registrados' : null),
          ),
          items: [
            for (final v in _vehicles)
              DropdownMenuItem(value: v.id, child: Text('${v.title} · ${v.licensePlate}', overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (widget.locked || _vehicles.isEmpty)
              ? null
              : (valor) {
                  setState(() => _vehicleId = valor);
                  _notificar();
                },
          validator: (v) => v == null ? 'El vehículo es obligatorio.' : null,
        ),
        if (_loading)
          const Padding(padding: EdgeInsets.only(top: AppSpacing.sm), child: LinearProgressIndicator(minHeight: 2)),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_error!, style: texto.bodySmall?.copyWith(color: AppColors.danger)),
          ),
      ],
    );
  }
}
