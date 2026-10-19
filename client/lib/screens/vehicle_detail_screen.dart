import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/vehicle.dart';
import '../providers/auth_provider.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import 'vehicle_form_screen.dart';

/// Detalle de un vehículo con su propietario. El mecánico solo consulta.
class VehicleDetailScreen extends StatefulWidget {
  const VehicleDetailScreen({super.key, required this.vehicleId});

  final int vehicleId;

  @override
  State<VehicleDetailScreen> createState() => _VehicleDetailScreenState();
}

class _VehicleDetailScreenState extends State<VehicleDetailScreen> {
  Vehicle? _vehicle;
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
      final vehiculo = await context.read<VehiclesProvider>().fetchDetail(widget.vehicleId);
      if (mounted) setState(() => _vehicle = vehiculo);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => VehicleFormScreen(vehicle: _vehicle)),
    );
    if (guardado == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final puedeEscribir = context.select<AuthProvider, bool>((a) => a.canManageRecords);
    return Scaffold(
      appBar: AppBar(
        title: Text(_vehicle?.title ?? 'Detalle del vehículo'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(puedeEscribir),
    );
  }

  Widget _buildBody(bool puedeEscribir) {
    if (_loading && _vehicle == null) return const LoadingState();
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final vehiculo = _vehicle!;
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
                      Expanded(child: Text(vehiculo.title, style: texto.titleLarge)),
                      Text(vehiculo.licensePlate, style: texto.titleMedium),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _Dato(etiqueta: 'Propietario', valor: vehiculo.clientName ?? '—'),
                  _Dato(
                    etiqueta: 'Teléfono',
                    valor: vehiculo.clientPhone == null ? '—' : formatPhone(vehiculo.clientPhone!),
                  ),
                  _Dato(etiqueta: 'Kilometraje', valor: formatMileage(vehiculo.currentMileage)),
                  _Dato(etiqueta: 'Número de serie', valor: vehiculo.vin ?? 'No registrado'),
                  if (puedeEscribir) ...[
                    const SizedBox(height: AppSpacing.lg),
                    OutlinedButton(onPressed: _edit, child: const Text('Editar')),
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
        children: [
          SizedBox(width: 140, child: Text(etiqueta, style: texto.bodySmall)),
          Expanded(child: Text(valor, style: texto.bodyLarge)),
        ],
      ),
    );
  }
}
