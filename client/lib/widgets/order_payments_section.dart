import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/api_error.dart';
import '../models/order_status.dart';
import '../models/payment.dart';
import '../providers/payments_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'state_views.dart';
import 'confirm_dialog.dart';
import 'mercado_pago_dialog.dart';
import 'payment_dialog.dart';
import 'payment_summary_card.dart';
import 'payments_table.dart';
import 'panel.dart';
import 'void_payment_dialog.dart';

/// Sección "Pagos" del detalle de la orden (administración y recepción): resumen de cobro,
/// tabla de pagos y acciones. Solo se muestra cuando la orden está terminada o entregada.
class OrderPaymentsSection extends StatefulWidget {
  const OrderPaymentsSection({
    super.key,
    required this.orderId,
    required this.orderStatus,
    required this.orderTotal,
    required this.canVoid,
  });

  final int orderId;
  final OrderStatus orderStatus;
  final double orderTotal;

  /// Solo el administrador puede anular pagos aprobados.
  final bool canVoid;

  @override
  State<OrderPaymentsSection> createState() => _OrderPaymentsSectionState();
}

class _OrderPaymentsSectionState extends State<OrderPaymentsSection> {
  late PaymentsProvider _provider;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _provider = context.read<PaymentsProvider>();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<PaymentsProvider>().loadForOrder(widget.orderId);
    });
  }

  @override
  void didUpdateWidget(OrderPaymentsSection anterior) {
    super.didUpdateWidget(anterior);
    // Si cambió el estado o el total de la orden, el saldo también pudo cambiar.
    if (anterior.orderId != widget.orderId ||
        anterior.orderStatus != widget.orderStatus ||
        anterior.orderTotal != widget.orderTotal) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _provider.loadForOrder(widget.orderId);
      });
    }
  }

  @override
  void dispose() {
    _provider.clearOrder();
    super.dispose();
  }

  void _mostrarError(ApiError error) => showAppSnackBar(context, error.message, isError: true);

  Future<void> _register(PaymentSummary resumen) async {
    final PaymentInput? datos = await showPaymentDialog(context, summary: resumen, allowMercadoPago: true);
    if (datos == null || !mounted) return;
    if (datos.method == PaymentMethod.mercadoPago) return _createMercadoPago(datos.amount);
    try {
      final PaymentResult r = await _provider.register(
        widget.orderId,
        method: datos.method,
        amount: datos.amount,
        reference: datos.reference,
        receivedAmount: datos.receivedAmount,
      );
      if (!mounted) return;
      final String cambio = r.change != null && r.change! > 0 ? ' Cambio: ${Format.money(r.change!)}.' : '';
      showAppSnackBar(context, 'Pago de ${Format.money(r.payment.amount)} registrado.$cambio');
    } on ApiError catch (error) {
      if (mounted) _mostrarError(error);
    }
  }

  /// Crea el cobro digital y muestra su enlace de pago. Si Mercado Pago no responde no se registra nada.
  Future<void> _createMercadoPago(double importe) async {
    try {
      final PaymentResult r = await _provider.createMercadoPago(widget.orderId, amount: importe);
      if (!mounted) return;
      await showMercadoPagoLinkDialog(context, payment: r.payment, onOpen: _openLink);
    } on ApiError catch (error) {
      if (mounted) _mostrarError(error);
    }
  }

  /// Pregunta a Mercado Pago el resultado del cobro y avisa qué pasó.
  Future<void> _refresh(Payment pago) async {
    try {
      final PaymentResult r = await _provider.refresh(widget.orderId, pago.id);
      if (!mounted) return;
      switch (r.payment.status) {
        case PaymentStatus.approved:
          showAppSnackBar(context, 'Mercado Pago aprobó el pago de ${Format.money(r.payment.amount)}.');
        case PaymentStatus.rejected:
          showAppSnackBar(context, 'Mercado Pago rechazó el cobro. El importe quedó libre.', isError: true);
        default:
          showAppSnackBar(context, 'Mercado Pago aún no informa el pago. Inténtalo de nuevo en unos minutos.');
      }
    } on ApiError catch (error) {
      if (mounted) _mostrarError(error);
    }
  }

  Future<void> _cancel(Payment pago) async {
    final bool confirmar = await showConfirmDialog(
      context,
      title: 'Cancelar cobro',
      message: confirmationText(
        'cancelar el cobro de ${Format.money(pago.amount)} por ${pago.method.label}',
        irreversible: false,
      ),
      confirmLabel: 'Cancelar cobro',
    );
    if (!confirmar || !mounted) return;
    try {
      await _provider.cancel(widget.orderId, pago.id);
      if (mounted) showAppSnackBar(context, 'Cobro cancelado.');
    } on ApiError catch (error) {
      if (mounted) _mostrarError(error);
    }
  }

  Future<void> _void(Payment pago) async {
    final String? motivo = await showVoidPaymentDialog(context, pago);
    if (motivo == null || !mounted) return;
    final bool confirmar = await showConfirmDialog(
      context,
      title: 'Anular pago',
      message: confirmationText(
        'anular el pago de ${Format.money(pago.amount)} por ${pago.method.label}',
      ),
      confirmLabel: 'Anular pago',
    );
    if (!confirmar || !mounted) return;
    try {
      await _provider.voidPayment(widget.orderId, pago.id, motivo);
      if (mounted) showAppSnackBar(context, 'Pago anulado.');
    } on ApiError catch (error) {
      if (mounted) _mostrarError(error);
    }
  }

  Future<void> _openLink(Payment pago) async {
    final Uri? enlace = Uri.tryParse(pago.paymentUrl ?? '');
    if (enlace == null) return;
    final bool abierto = await launchUrl(enlace, mode: LaunchMode.externalApplication);
    if (!abierto && mounted) {
      showAppSnackBar(context, 'No se pudo abrir el enlace de pago.', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final PaymentsProvider provider = context.watch<PaymentsProvider>();
    final OrderPayments? datos = provider.order;
    final TextTheme text = Theme.of(context).textTheme;
    final bool cobrable =
        widget.orderStatus == OrderStatus.finished || widget.orderStatus == OrderStatus.delivered;

    Widget contenido;
    if (datos == null) {
      contenido = provider.orderError != null
          ? Row(
              children: <Widget>[
                Expanded(child: Text(provider.orderError!, style: text.bodyMedium)),
                TextButton(
                  onPressed: () => provider.loadForOrder(widget.orderId),
                  child: const Text('Reintentar'),
                ),
              ],
            )
          : const Center(child: Padding(padding: EdgeInsets.all(AppSpacing.lg), child: CircularProgressIndicator()));
    } else {
      final PaymentSummary resumen = datos.summary;
      contenido = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          PaymentSummaryCard(summary: resumen),
          if (!cobrable) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Los pagos se registran cuando la orden está terminada o entregada.',
              style: text.bodySmall,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          PaymentsTable(
            payments: datos.payments,
            onCancel: _cancel,
            onRefresh: _refresh,
            onVoid: widget.canVoid ? _void : null,
            onOpenLink: _openLink,
          ),
          if (cobrable && resumen.canCharge) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.icon(
                onPressed: () => _register(resumen),
                icon: const Icon(LucideIcons.banknote, size: 18),
                label: const Text('Registrar pago'),
              ),
            ),
          ],
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text('Pagos', style: text.titleMedium),
        const SizedBox(height: AppSpacing.md),
        Panel(padding: const EdgeInsets.all(AppSpacing.lg), child: contenido),
      ],
    );
  }
}
