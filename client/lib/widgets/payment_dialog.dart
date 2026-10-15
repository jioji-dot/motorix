import 'package:flutter/material.dart';

import '../models/payment.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../utils/validators.dart';

/// Datos capturados al registrar un pago.
class PaymentInput {
  const PaymentInput({
    required this.method,
    required this.amount,
    this.reference,
    this.receivedAmount,
  });

  final PaymentMethod method;
  final double amount;

  /// Autorización u operación informativa (tarjeta y transferencia). Nunca datos de tarjeta.
  final String? reference;

  /// Solo efectivo: con cuánto pagó el cliente, para calcular el cambio.
  final double? receivedAmount;
}

/// Diálogo para registrar un pago de la orden: método, importe (por omisión el saldo disponible),
/// importe recibido y cambio en efectivo, y referencia en tarjeta y transferencia.
/// Devuelve los datos o null si se cancela. No solicita ni guarda datos de tarjeta.
Future<PaymentInput?> showPaymentDialog(
  BuildContext context, {
  required PaymentSummary summary,
  bool allowMercadoPago = false,
}) {
  return showDialog<PaymentInput>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) =>
        _PaymentDialog(summary: summary, allowMercadoPago: allowMercadoPago),
  );
}

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({required this.summary, required this.allowMercadoPago});

  final PaymentSummary summary;
  final bool allowMercadoPago;

  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _amount;
  final TextEditingController _received = TextEditingController();
  final TextEditingController _reference = TextEditingController();
  PaymentMethod _method = PaymentMethod.cash;

  @override
  void initState() {
    super.initState();
    _amount = TextEditingController(text: widget.summary.available.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _amount.dispose();
    _received.dispose();
    _reference.dispose();
    super.dispose();
  }

  List<PaymentMethod> get _methods => <PaymentMethod>[
        PaymentMethod.cash,
        PaymentMethod.card,
        PaymentMethod.transfer,
        if (widget.allowMercadoPago) PaymentMethod.mercadoPago,
      ];

  double? get _parsedAmount => Validators.parseDecimal(_amount.text);

  /// Cambio calculado mientras se captura (no se guarda).
  double? get _change {
    final double? importe = _parsedAmount;
    final double? recibido = Validators.parseDecimal(_received.text);
    if (importe == null || recibido == null || recibido < importe) return null;
    return ((recibido - importe) * 100).roundToDouble() / 100;
  }

  String? _validateAmount(String? valor) {
    if ((valor ?? '').trim().isEmpty) return 'Ingresa el importe.';
    final double? importe = Validators.parseDecimal(valor);
    if (importe == null) return 'Usa un número con máximo dos decimales.';
    if (importe <= 0) return 'El importe debe ser mayor a cero.';
    if (importe > widget.summary.available + 0.0001) {
      return 'No puede superar el saldo disponible (${Format.money(widget.summary.available)}).';
    }
    return null;
  }

  String? _validateReceived(String? valor) {
    if ((valor ?? '').trim().isEmpty) return null;
    final double? recibido = Validators.parseDecimal(valor);
    if (recibido == null) return 'Usa un número con máximo dos decimales.';
    final double? importe = _parsedAmount;
    if (importe != null && recibido < importe) return 'No puede ser menor al importe del pago.';
    return null;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final String referencia = _reference.text.trim();
    final bool esEfectivo = _method == PaymentMethod.cash;
    final bool pideReferencia = _method == PaymentMethod.card || _method == PaymentMethod.transfer;
    Navigator.of(context).pop(PaymentInput(
      method: _method,
      amount: _parsedAmount!,
      reference: pideReferencia && referencia.isNotEmpty ? referencia : null,
      receivedAmount: esEfectivo && _received.text.trim().isNotEmpty
          ? Validators.parseDecimal(_received.text)
          : null,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final double? cambio = _change;
    return AlertDialog(
      title: const Text('Registrar pago'),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          onChanged: () => setState(() {}),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'Saldo disponible: ${Format.money(widget.summary.available)}',
                  style: text.bodyLarge,
                ),
                const SizedBox(height: AppSpacing.lg),
                DropdownButtonFormField<PaymentMethod>(
                  initialValue: _method,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Método de pago *'),
                  items: <DropdownMenuItem<PaymentMethod>>[
                    for (final PaymentMethod m in _methods)
                      DropdownMenuItem<PaymentMethod>(value: m, child: Text(m.label)),
                  ],
                  onChanged: (PaymentMethod? m) => setState(() => _method = m ?? _method),
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  controller: _amount,
                  autofocus: true,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Importe *'),
                  validator: _validateAmount,
                ),
                if (_method == PaymentMethod.cash) ...<Widget>[
                  const SizedBox(height: AppSpacing.lg),
                  TextFormField(
                    controller: _received,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Importe recibido',
                      helperText: 'Opcional: con cuánto pagó el cliente, para calcular el cambio.',
                    ),
                    validator: _validateReceived,
                  ),
                  if (cambio != null) ...<Widget>[
                    const SizedBox(height: AppSpacing.sm),
                    Text('Cambio: ${Format.money(cambio)}', style: text.titleMedium),
                  ],
                ],
                if (_method == PaymentMethod.card || _method == PaymentMethod.transfer) ...<Widget>[
                  const SizedBox(height: AppSpacing.lg),
                  TextFormField(
                    controller: _reference,
                    decoration: InputDecoration(
                      labelText: _method == PaymentMethod.card
                          ? 'Referencia de la autorización'
                          : 'Referencia de la operación',
                      helperText: 'Opcional. No captures números de tarjeta.',
                    ),
                    validator: (String? v) => Validators.maxLength(v, 100),
                  ),
                ],
                if (_method == PaymentMethod.mercadoPago) ...<Widget>[
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Se generará un enlace de pago en Mercado Pago (modo de pruebas). El cobro queda '
                    'pendiente hasta que Mercado Pago informe el resultado.',
                    style: text.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: <Widget>[
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          onPressed: _submit,
          child: Text(_method == PaymentMethod.mercadoPago ? 'Generar cobro' : 'Registrar pago'),
        ),
      ],
    );
  }
}
