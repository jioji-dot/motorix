import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/history_entry.dart';
import '../providers/vehicles_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';

/// Historial de servicios de un vehículo: órdenes terminadas y entregadas, de la más reciente a la más antigua.
class VehicleHistoryScreen extends StatefulWidget {
  const VehicleHistoryScreen({super.key, required this.vehicleId, required this.vehicleTitle});

  final int vehicleId;
  final String vehicleTitle;

  @override
  State<VehicleHistoryScreen> createState() => _VehicleHistoryScreenState();
}

class _VehicleHistoryScreenState extends State<VehicleHistoryScreen> {
  List<HistoryEntry> _entries = [];
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
      final entradas = await context.read<VehiclesProvider>().history(widget.vehicleId);
      if (mounted) setState(() => _entries = entradas);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Historial · ${widget.vehicleTitle}', overflow: TextOverflow.ellipsis),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _entries.isEmpty) return const LoadingState(message: 'Cargando historial...');
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    if (_entries.isEmpty) {
      return const EmptyState(
        icon: LucideIcons.history,
        title: 'Sin servicios registrados',
        message: 'Las órdenes terminadas o entregadas de este vehículo aparecerán aquí.',
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final entrada in _entries) ...[
                _TarjetaDeServicio(entrada: entrada),
                const SizedBox(height: AppSpacing.lg),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _TarjetaDeServicio extends StatelessWidget {
  const _TarjetaDeServicio({required this.entrada});

  final HistoryEntry entrada;

  Widget _texto(BuildContext context, String titulo, String? valor) {
    if ((valor ?? '').trim().isEmpty) return const SizedBox.shrink();
    final texto = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: texto.bodySmall),
          Text(valor!, style: texto.bodyLarge),
        ],
      ),
    );
  }

  Widget _linea(BuildContext context, String descripcion, String detalle, String importe) {
    final texto = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(child: Text(descripcion, overflow: TextOverflow.ellipsis)),
          if (detalle.isNotEmpty) ...[
            Flexible(child: Text(detalle, style: texto.bodySmall, overflow: TextOverflow.ellipsis)),
            const SizedBox(width: AppSpacing.md),
          ],
          Text(formatMoney(importe)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      key: Key('servicio-${entrada.orderId}'),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('${formatDate(entrada.serviceDate)} · ${entrada.folio}', style: texto.titleMedium)),
                StatusChip.order(entrada.status),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${formatMileage(entrada.mileage)} · Mecánico: ${entrada.mechanicName}',
              style: texto.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            _texto(context, 'Diagnóstico', entrada.diagnosis),
            if (entrada.services.isNotEmpty) ...[
              Text('Servicios', style: texto.titleSmall),
              for (final s in entrada.services) _linea(context, s.description, '', s.amount),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (entrada.labor.isNotEmpty) ...[
              Text('Mano de obra', style: texto.titleSmall),
              for (final l in entrada.labor) _linea(context, l.description, '${l.hours} h × ${formatMoney(l.hourlyRate)}', l.amount),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (entrada.parts.isNotEmpty) ...[
              Text('Refacciones', style: texto.titleSmall),
              for (final p in entrada.parts)
                _linea(context, p.name, '${p.quantity} × ${formatMoney(p.unitPrice)}', p.amount),
              const SizedBox(height: AppSpacing.sm),
            ],
            _texto(context, 'Observaciones', entrada.notes),
            _texto(context, 'Recomendaciones', entrada.recommendations),
            const Divider(height: AppSpacing.xl),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text('Total  ', style: texto.titleSmall),
                Text(formatMoney(entrada.total), style: texto.titleMedium),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
