import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../providers/auth_provider.dart';
import '../providers/clients_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'client_form_screen.dart';

/// Detalle de un cliente con sus vehículos asociados. El mecánico solo consulta.
class ClientDetailScreen extends StatefulWidget {
  const ClientDetailScreen({super.key, required this.clientId, this.onRegisterVehicle});

  final int clientId;

  /// Acción para registrar un vehículo de este cliente (se conecta en la pantalla de vehículos).
  final Future<void> Function(BuildContext context, Client client)? onRegisterVehicle;

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  Client? _client;
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
      final cliente = await context.read<ClientsProvider>().fetchDetail(widget.clientId);
      if (mounted) setState(() => _client = cliente);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ClientFormScreen(client: _client)),
    );
    if (guardado == true) await _load();
  }

  Future<void> _toggleActive() async {
    final cliente = _client!;
    if (cliente.active) {
      final confirmado = await showConfirmDialog(
        context,
        title: 'Desactivar cliente',
        message: '${cliente.name} dejará de aparecer como activo. Su información y sus vehículos se conservan.',
        confirmLabel: 'Confirmar',
        destructive: true,
      );
      if (!confirmado || !mounted) return;
    }
    try {
      await context.read<ClientsProvider>().update(cliente.id, {'active': !cliente.active});
      if (!mounted) return;
      showFeedback(context, cliente.active ? 'Cliente desactivado.' : 'Cliente reactivado.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final puedeEscribir = context.select<AuthProvider, bool>((a) => a.canManageRecords);
    return Scaffold(
      appBar: AppBar(
        title: Text(_client?.name ?? 'Detalle del cliente'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(puedeEscribir),
    );
  }

  Widget _buildBody(bool puedeEscribir) {
    if (_loading && _client == null) return const LoadingState();
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final cliente = _client!;
    final texto = Theme.of(context).textTheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(cliente.name, style: texto.titleLarge)),
                          StatusChip.active(cliente.active),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _Dato(etiqueta: 'Teléfono', valor: formatPhone(cliente.phone)),
                      _Dato(etiqueta: 'Correo', valor: cliente.email ?? '—'),
                      _Dato(etiqueta: 'Registro', valor: formatDate(cliente.createdAt)),
                      if (puedeEscribir) ...[
                        const SizedBox(height: AppSpacing.lg),
                        Row(
                          children: [
                            OutlinedButton(onPressed: _edit, child: const Text('Editar')),
                            const SizedBox(width: AppSpacing.md),
                            OutlinedButton(
                              onPressed: _toggleActive,
                              child: Text(cliente.active ? 'Desactivar' : 'Reactivar'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              Row(
                children: [
                  Expanded(child: Text('Vehículos', style: texto.titleMedium)),
                  if (puedeEscribir && widget.onRegisterVehicle != null && cliente.vehicles.isNotEmpty)
                    OutlinedButton(
                      onPressed: () async {
                        await widget.onRegisterVehicle!(context, cliente);
                        if (mounted) await _load();
                      },
                      child: const Text('Registrar vehículo'),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Card(
                child: cliente.vehicles.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
                        child: EmptyState(
                          icon: LucideIcons.car,
                          title: 'Este cliente aún no tiene vehículos',
                          message: 'Los vehículos que registres para este cliente aparecerán aquí.',
                          actionLabel: (puedeEscribir && widget.onRegisterVehicle != null) ? 'Registrar vehículo' : null,
                          onAction: (puedeEscribir && widget.onRegisterVehicle != null)
                              ? () async {
                                  await widget.onRegisterVehicle!(context, cliente);
                                  if (mounted) await _load();
                                }
                              : null,
                        ),
                      )
                    : Column(
                        children: [
                          for (final vehiculo in cliente.vehicles) ...[
                            ListTile(
                              leading: const Icon(LucideIcons.car, size: 20),
                              title: Text(vehiculo.title),
                              subtitle: Text(formatMileage(vehiculo.currentMileage)),
                              trailing: Text(vehiculo.licensePlate, style: texto.titleSmall),
                            ),
                            if (vehiculo != cliente.vehicles.last) const Divider(),
                          ],
                        ],
                      ),
              ),
            ],
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
          SizedBox(width: 120, child: Text(etiqueta, style: texto.bodySmall)),
          Expanded(child: Text(valor, style: texto.bodyLarge)),
        ],
      ),
    );
  }
}
