import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/payment.dart';
import '../services/external_links.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'state_views.dart';

/// Datos capturados al registrar un pago.
class PaymentRequest {
  const PaymentRequest({required this.method, required this.amount, this.reference});

  final String method;
  final double amount;
  final String? reference;
}

/// Una referencia con forma de número de tarjeta (13 a 19 dígitos) se rechaza igual que en el servidor.
final _pareceTarjeta = RegExp(r'(?:\d[ -]?){13,19}');

/// Diálogo para registrar un pago: método, importe (por defecto el saldo disponible) y referencia opcional.
Future<PaymentRequest?> showRegisterPaymentDialog(BuildContext context, {required String available}) {
  return showDialog<PaymentRequest>(context: context, builder: (_) => _RegisterPaymentDialog(available: available));
}

class _RegisterPaymentDialog extends StatefulWidget {
  const _RegisterPaymentDialog({required this.available});

  final String available;

  @override
  State<_RegisterPaymentDialog> createState() => _RegisterPaymentDialogState();
}

class _RegisterPaymentDialogState extends State<_RegisterPaymentDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amount = TextEditingController(text: widget.available);
  final _reference = TextEditingController();
  String? _method;

  @override
  void dispose() {
    _amount.dispose();
    _reference.dispose();
    super.dispose();
  }

  String? _validarImporte(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'El importe es obligatorio.';
    final numero = double.tryParse(texto);
    if (numero == null) return 'El importe no es válido.';
    if (numero <= 0) return 'El importe debe ser mayor a 0.';
    if ((numero * 100 - (numero * 100).roundToDouble()).abs() > 1e-6) return 'El importe puede tener hasta dos decimales.';
    if (numero > double.parse(widget.available) + 1e-9) {
      return 'El importe no puede ser mayor al saldo disponible (${formatMoney(widget.available)}).';
    }
    return null;
  }

  String? _validarReferencia(String? valor) {
    final texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    if (texto.length > 100) return 'La referencia no puede tener más de 100 caracteres.';
    if (_pareceTarjeta.hasMatch(texto)) return 'La referencia no puede contener un número de tarjeta.';
    return null;
  }

  String get _etiquetaReferencia => switch (_method) {
        'TARJETA' => 'Número de autorización (opcional)',
        'TRANSFERENCIA' => 'Referencia de la transferencia (opcional)',
        _ => 'Referencia (opcional)',
      };

  void _guardar() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(PaymentRequest(
      method: _method!,
      amount: double.parse(_amount.text.trim()),
      reference: _method == 'MERCADO_PAGO' ? null : _reference.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return AlertDialog(
      title: const Text('Registrar pago'),
      content: SizedBox(
        width: 440,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  key: const Key('campo-metodo-pago'),
                  initialValue: _method,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Método de pago'),
                  items: [
                    for (final metodo in const ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'MERCADO_PAGO'])
                      DropdownMenuItem(value: metodo, child: Text(paymentMethodLabel(metodo))),
                  ],
                  onChanged: (valor) => setState(() => _method = valor),
                  validator: (v) => v == null ? 'El método de pago es obligatorio.' : null,
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  key: const Key('campo-importe-pago'),
                  controller: _amount,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: 'Importe', helperText: 'Saldo disponible: ${formatMoney(widget.available)}'),
                  validator: _validarImporte,
                ),
                if (_method != 'MERCADO_PAGO') ...[
                  const SizedBox(height: AppSpacing.lg),
                  TextFormField(
                    key: const Key('campo-referencia-pago'),
                    controller: _reference,
                    maxLength: 100,
                    decoration: InputDecoration(labelText: _etiquetaReferencia, counterText: ''),
                    validator: _validarReferencia,
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                if (_method == 'TARJETA')
                  Text(
                    key: const Key('nota-terminal'),
                    'La tarjeta se cobra en la terminal externa; aquí solo se registra el pago. Motorix no pide ni guarda datos de tarjeta.',
                    style: texto.bodySmall,
                  ),
                if (_method == 'MERCADO_PAGO')
                  Text(
                    key: const Key('nota-mercado-pago'),
                    'Se generará un enlace de pago para que el cliente pague en la página de Mercado Pago (modo de pruebas).',
                    style: texto.bodySmall,
                  ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _guardar, child: Text(_method == 'MERCADO_PAGO' ? 'Generar enlace' : 'Registrar')),
      ],
    );
  }
}

/// Muestra el enlace de pago de Mercado Pago: se puede copiar, abrir en el navegador o leer con el código QR.
Future<void> showMercadoPagoLinkDialog(BuildContext context, Payment payment) {
  return showDialog<void>(context: context, builder: (_) => _MercadoPagoLinkDialog(payment: payment));
}

class _MercadoPagoLinkDialog extends StatelessWidget {
  const _MercadoPagoLinkDialog({required this.payment});

  final Payment payment;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final enlace = payment.paymentLink ?? '';
    return AlertDialog(
      title: const Text('Enlace de pago de Mercado Pago'),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Importe: ${formatMoney(payment.amount)} · Pendiente de pago', style: texto.titleSmall),
              const SizedBox(height: AppSpacing.md),
              Text('Comparte el enlace o muestra el código QR al cliente. El pago se actualiza cuando Mercado Pago lo confirme, o con "Actualizar estado".', style: texto.bodySmall),
              const SizedBox(height: AppSpacing.lg),
              Center(child: QrImageView(key: const Key('codigo-qr'), data: enlace, size: 160, backgroundColor: AppColors.surface)),
              const SizedBox(height: AppSpacing.lg),
              SelectableText(enlace, key: const Key('enlace-de-pago'), style: texto.bodySmall),
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(
          key: const Key('boton-copiar-enlace'),
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: enlace));
            if (context.mounted) showFeedback(context, 'Enlace copiado.');
          },
          child: const Text('Copiar'),
        ),
        OutlinedButton(
          key: const Key('boton-abrir-enlace'),
          onPressed: () => openExternalUrl(Uri.parse(enlace)),
          child: const Text('Abrir'),
        ),
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Listo')),
      ],
    );
  }
}
