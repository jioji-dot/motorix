import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/service_order.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';

/// Detalle de una orden de servicio: datos, trabajo documentado, líneas, total e historial.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  ServiceOrder? _order;
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
      final orden = await context.read<OrdersProvider>().fetchDetail(widget.orderId);
      if (mounted) setState(() => _order = orden);
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
        title: Text(_order?.folio ?? 'Orden de servicio'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _order == null) return const LoadingState();
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final orden = _order!;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DatosGenerales(orden: orden),
              const SizedBox(height: AppSpacing.lg),
              _TrabajoDocumentado(orden: orden),
              const SizedBox(height: AppSpacing.lg),
              _Lineas(orden: orden),
              const SizedBox(height: AppSpacing.lg),
              _Historial(orden: orden),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarjeta con título de sección.
class _Seccion extends StatelessWidget {
  const _Seccion({required this.titulo, required this.child});

  final String titulo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: texto.titleMedium),
            const SizedBox(height: AppSpacing.md),
            child,
          ],
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 160, child: Text(etiqueta, style: texto.bodySmall)),
          Expanded(child: Text(valor, style: texto.bodyLarge)),
        ],
      ),
    );
  }
}

class _DatosGenerales extends StatelessWidget {
  const _DatosGenerales({required this.orden});

  final ServiceOrder orden;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(orden.folio, style: texto.titleLarge)),
                StatusChip.order(orden.status),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            _Dato(etiqueta: 'Cliente', valor: orden.clientName),
            _Dato(etiqueta: 'Vehículo', valor: '${orden.vehicleTitle} · ${orden.licensePlate}'),
            _Dato(etiqueta: 'Mecánico asignado', valor: orden.mechanicName),
            _Dato(etiqueta: 'Kilometraje de entrada', valor: formatMileage(orden.entryMileage)),
            _Dato(etiqueta: 'Fecha de creación', valor: formatDateTime(orden.createdAt)),
            _Dato(etiqueta: 'Problema reportado', valor: orden.reportedProblem),
            if (orden.status == 'CANCELADA')
              _Dato(etiqueta: 'Motivo de cancelación', valor: orden.cancellationReason ?? '—'),
            if (orden.deliveredAt != null) _Dato(etiqueta: 'Fecha de entrega', valor: formatDateTime(orden.deliveredAt)),
          ],
        ),
      ),
    );
  }
}

class _TrabajoDocumentado extends StatelessWidget {
  const _TrabajoDocumentado({required this.orden});

  final ServiceOrder orden;

  Widget _bloque(BuildContext context, String titulo, String? valor, String vacio) {
    final texto = Theme.of(context).textTheme;
    final hayTexto = (valor ?? '').trim().isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: texto.bodySmall),
          const SizedBox(height: AppSpacing.xs),
          Text(
            hayTexto ? valor! : vacio,
            style: hayTexto ? texto.bodyLarge : texto.bodyLarge?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _Seccion(
      titulo: 'Trabajo documentado',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _bloque(context, 'Diagnóstico', orden.diagnosis, 'Sin diagnóstico registrado'),
          _bloque(context, 'Observaciones', orden.notes, 'Sin observaciones'),
          _bloque(context, 'Recomendaciones', orden.recommendations, 'Sin recomendaciones'),
        ],
      ),
    );
  }
}

class _Lineas extends StatelessWidget {
  const _Lineas({required this.orden});

  final ServiceOrder orden;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return _Seccion(
      titulo: 'Servicios y mano de obra',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Servicios realizados', style: texto.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          if (orden.services.isEmpty)
            Text('Sin servicios registrados', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
          else
            for (final s in orden.services)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(child: Text(s.description)),
                    Text(formatMoney(s.amount)),
                  ],
                ),
              ),
          const Divider(height: AppSpacing.xl),
          Text('Mano de obra', style: texto.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          if (orden.labor.isEmpty)
            Text('Sin mano de obra registrada', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
          else
            for (final l in orden.labor)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(child: Text(l.description)),
                    Text('${l.hours} h × ${formatMoney(l.hourlyRate)}', style: texto.bodySmall),
                    const SizedBox(width: AppSpacing.lg),
                    Text(formatMoney(l.amount)),
                  ],
                ),
              ),
          const Divider(height: AppSpacing.xl),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('Total  ', style: texto.titleSmall),
              Text(formatMoney(orden.total), style: texto.titleMedium),
            ],
          ),
        ],
      ),
    );
  }
}

class _Historial extends StatelessWidget {
  const _Historial({required this.orden});

  final ServiceOrder orden;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return _Seccion(
      titulo: 'Historial de estados',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final h in orden.history)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 160, child: Text(formatDateTime(h.changedAt), style: texto.bodySmall)),
                  StatusChip.order(h.toStatus),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      h.reason == null || h.reason!.isEmpty ? h.changedBy : '${h.changedBy} · ${h.reason}',
                      style: texto.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
