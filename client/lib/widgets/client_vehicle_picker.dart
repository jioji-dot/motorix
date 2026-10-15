import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../models/vehicle.dart';
import '../services/clients_service.dart';
import '../utils/app_theme.dart';
import 'owner_picker.dart';

/// Selector de cliente y de uno de sus vehículos, usado en los formularios de citas y órdenes.
/// Al elegir un cliente carga sus vehículos; al cambiarlo se limpia el vehículo.
class ClientVehiclePicker extends StatefulWidget {
  const ClientVehiclePicker({
    super.key,
    required this.client,
    required this.vehicleId,
    required this.onClientChanged,
    required this.onVehicleChanged,
    this.clientError,
    this.vehicleError,
    this.enabled = true,
    this.lockClient = false,
    this.lockVehicle = false,
  });

  final Client? client;
  final int? vehicleId;
  final ValueChanged<Client?> onClientChanged;
  final ValueChanged<int?> onVehicleChanged;
  final String? clientError;
  final String? vehicleError;
  final bool enabled;

  /// Bloquea el cambio de cliente (por ejemplo, al crear una orden desde una cita).
  final bool lockClient;
  final bool lockVehicle;

  @override
  State<ClientVehiclePicker> createState() => _ClientVehiclePickerState();
}

class _ClientVehiclePickerState extends State<ClientVehiclePicker> {
  List<Vehicle> _vehicles = <Vehicle>[];
  bool _loading = false;
  String? _loadError;
  int? _loadedFor;

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  @override
  void didUpdateWidget(covariant ClientVehiclePicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.client?.id != _loadedFor) _loadVehicles();
  }

  Future<void> _loadVehicles() async {
    final Client? cliente = widget.client;
    _loadedFor = cliente?.id;
    if (cliente == null) {
      setState(() {
        _vehicles = <Vehicle>[];
        _loadError = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final Client detalle = await context.read<ClientsService>().get(cliente.id);
      if (!mounted || _loadedFor != cliente.id) return;
      setState(() => _vehicles = detalle.vehicles);
    } catch (_) {
      if (!mounted || _loadedFor != cliente.id) return;
      setState(() => _loadError = 'No se pudieron cargar los vehículos del cliente.');
    } finally {
      if (mounted && _loadedFor == cliente.id) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final bool hayCliente = widget.client != null;
    final bool vehiculoValido = _vehicles.any((Vehicle v) => v.id == widget.vehicleId);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        OwnerPicker(
          label: 'Cliente *',
          selected: widget.client,
          enabled: widget.enabled && !widget.lockClient,
          errorText: widget.clientError,
          onChanged: (Client? c) {
            widget.onClientChanged(c);
            widget.onVehicleChanged(null);
          },
        ),
        const SizedBox(height: AppSpacing.lg),
        DropdownButtonFormField<int>(
          key: ValueKey<String>('${widget.client?.id}-${_vehicles.length}-${widget.vehicleId}'),
          initialValue: vehiculoValido ? widget.vehicleId : null,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: 'Vehículo *',
            errorText: widget.vehicleError,
            hintText: !hayCliente
                ? 'Elige primero al cliente'
                : _loading
                    ? 'Cargando vehículos…'
                    : _vehicles.isEmpty
                        ? 'Este cliente no tiene vehículos'
                        : 'Elige el vehículo',
          ),
          items: <DropdownMenuItem<int>>[
            for (final Vehicle v in _vehicles)
              DropdownMenuItem<int>(
                value: v.id,
                child: Text('${v.licensePlate} · ${v.title} (${v.year})'),
              ),
          ],
          onChanged: (widget.enabled && !widget.lockVehicle && _vehicles.isNotEmpty)
              ? widget.onVehicleChanged
              : null,
        ),
        if (_loadError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_loadError!, style: text.bodySmall?.copyWith(color: AppColors.danger)),
          ),
        if (hayCliente && !_loading && _vehicles.isEmpty && _loadError == null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              'Registra primero un vehículo para este cliente.',
              style: text.bodySmall,
            ),
          ),
      ],
    );
  }
}
