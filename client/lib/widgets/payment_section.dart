import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/payment.dart';
import '../providers/payments_provider.dart';
import '../screens/ticket_screen.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'button_spinner.dart';
import 'confirm_dialog.dart';
import 'payment_dialogs.dart';
import 'state_views.dart';
import 'status_chip.dart';

/// Bloque "Pagos" del detalle de una orden Terminada o Entregada: resumen de cobro, pagos y ticket.
/// Solo lo ven recepción y administración (el servidor también lo exige).
class PaymentSection extends StatefulWidget {
  const PaymentSection({super.key, required this.orderId});

  final int orderId;

  @override
  State<PaymentSection> createState() => _PaymentSectionState();
}

class _PaymentSectionState extends State<PaymentSection> {
  PaymentsData? _data;
  bool _loading = true;
  bool _busy = false;
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
      final datos = await context.read<PaymentsProvider>().list(widget.orderId);
      if (mounted) setState(() => _data = datos);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Ejecuta una operación, avisa del resultado y vuelve a leer los pagos para mostrar el saldo real.
  Future<bool> _ejecutar(Future<void> Function(PaymentsProvider) accion, String exito) async {
    setState(() => _busy = true);
    try {
      await accion(context.read<PaymentsProvider>());
      if (!mounted) return false;
      showFeedback(context, exito);
      await _load();
      return true;
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
      // Si el saldo cambió mientras se capturaba, se recarga para mostrar el real.
      if (e.code == 'PAYMENT_EXCEEDS_BALANCE' || e.code == 'PAYMENT_NOT_PENDING') await _load();
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _registrar() async {
    final resumen = _data!.summary;
    final solicitud = await showRegisterPaymentDialog(context, available: resumen.available);
    if (solicitud == null || !mounted) return;
    Payment? creado;
    final ok = await _ejecutar((p) async {
      final resultado = await p.create(widget.orderId, method: solicitud.method, amount: solicitud.amount, reference: solicitud.reference);
      creado = resultado.payment;
    }, solicitud.method == 'MERCADO_PAGO' ? 'Enlace de pago generado.' : 'Pago registrado.');
    if (ok && creado != null && creado!.isPendingMercadoPago && mounted) {
      await showMercadoPagoLinkDialog(context, creado!);
    }
  }

  Future<void> _sincronizar(Payment pago) => _ejecutar((p) async {
        final actualizado = await p.sync(pago.id);
        if (mounted && actualizado.status == 'PENDIENTE') showFeedback(context, 'Mercado Pago aún no confirma el pago.');
      }, 'Estado actualizado.');

  Future<void> _cancelar(Payment pago) async {
    final confirmado = await showConfirmDialog(
      context,
      title: 'Cancelar pago',
      message: '¿Cancelar el pago pendiente de ${formatMoney(pago.amount)} con Mercado Pago? El importe volverá a estar disponible para cobrarse.',
      confirmLabel: 'Cancelar pago',
      cancelLabel: 'Volver',
      destructive: true,
    );
    if (!confirmado || !mounted) return;
    await _ejecutar((p) async => p.cancel(pago.id), 'Pago cancelado.');
  }

  void _abrirTicket() {
    Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => TicketScreen(orderId: widget.orderId))).then((_) {
      if (mounted) _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      key: const Key('seccion-pagos'),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(child: Text('Pagos', style: texto.titleMedium)),
                if (_data != null) StatusChip.collection(_data!.summary.status),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            if (_loading && _data == null)
              Row(
                children: [
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
                  const SizedBox(width: AppSpacing.md),
                  Text('Cargando pagos...', style: texto.bodySmall),
                ],
              )
            else if (_error != null && _data == null)
              Row(
                children: [
                  Expanded(child: Text(_error!, style: texto.bodyMedium?.copyWith(color: AppColors.danger))),
                  const SizedBox(width: AppSpacing.md),
                  OutlinedButton(onPressed: _load, child: const Text('Reintentar')),
                ],
              )
            else
              ..._contenido(_data!, texto),
          ],
        ),
      ),
    );
  }

  List<Widget> _contenido(PaymentsData datos, TextTheme texto) {
    final resumen = datos.summary;
    return [
      Wrap(
        spacing: AppSpacing.xl,
        runSpacing: AppSpacing.sm,
        children: [
          _Cifra(etiqueta: 'Total', valor: formatMoney(resumen.total)),
          _Cifra(etiqueta: 'Pagado', valor: formatMoney(resumen.paid)),
          if (double.parse(resumen.pending) > 0) _Cifra(etiqueta: 'Pendiente en Mercado Pago', valor: formatMoney(resumen.pending)),
          _Cifra(etiqueta: 'Saldo por cobrar', valor: formatMoney(resumen.balance)),
        ],
      ),
      const SizedBox(height: AppSpacing.lg),
      if (datos.payments.isEmpty)
        Text('Sin pagos registrados', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
      else
        for (final pago in datos.payments)
          _FilaDePago(pago: pago, busy: _busy, onSync: () => _sincronizar(pago), onCancel: () => _cancelar(pago), onLink: () => showMercadoPagoLinkDialog(context, pago)),
      const SizedBox(height: AppSpacing.lg),
      Wrap(
        spacing: AppSpacing.md,
        runSpacing: AppSpacing.md,
        children: [
          if (resumen.canCharge)
            FilledButton(
              key: const Key('boton-registrar-pago'),
              onPressed: _busy ? null : _registrar,
              child: _busy ? const ButtonSpinner() : const Text('Registrar pago'),
            ),
          OutlinedButton(key: const Key('boton-ticket'), onPressed: _abrirTicket, child: const Text('Generar ticket')),
        ],
      ),
    ];
  }
}

class _Cifra extends StatelessWidget {
  const _Cifra({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [Text(etiqueta, style: texto.bodySmall), Text(valor, style: texto.titleMedium)],
    );
  }
}

class _FilaDePago extends StatelessWidget {
  const _FilaDePago({required this.pago, required this.busy, required this.onSync, required this.onCancel, required this.onLink});

  final Payment pago;
  final bool busy;
  final VoidCallback onSync;
  final VoidCallback onCancel;
  final VoidCallback onLink;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final detalle = [
      if ((pago.reference ?? '').isNotEmpty) pago.reference!,
      pago.createdByName,
      formatDateTime(pago.paidAt ?? pago.createdAt),
    ].join(' · ');
    return Padding(
      key: Key('pago-${pago.id}'),
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text('${paymentMethodLabel(pago.method)} · ${formatMoney(pago.amount)}', style: texto.bodyLarge)),
              StatusChip.payment(pago.status),
            ],
          ),
          Text(detalle, style: texto.bodySmall),
          if (pago.isPendingMercadoPago)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.sm),
              child: Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  OutlinedButton(key: Key('ver-enlace-${pago.id}'), onPressed: busy ? null : onLink, child: const Text('Ver enlace')),
                  OutlinedButton(key: Key('actualizar-${pago.id}'), onPressed: busy ? null : onSync, child: const Text('Actualizar estado')),
                  OutlinedButton(
                    key: Key('cancelar-${pago.id}'),
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                    onPressed: busy ? null : onCancel,
                    child: const Text('Cancelar pago'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
