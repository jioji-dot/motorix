import 'package:flutter/material.dart';

import '../models/payment.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../utils/validators.dart';

/// Diálogo para anular un pago aprobado (solo administración). El motivo es obligatorio.
/// Devuelve el motivo o null si se cancela; el llamador pide la confirmación final.
Future<String?> showVoidPaymentDialog(BuildContext context, Payment payment) {
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _VoidPaymentDialog(payment: payment),
  );
}

class _VoidPaymentDialog extends StatefulWidget {
  const _VoidPaymentDialog({required this.payment});

  final Payment payment;

  @override
  State<_VoidPaymentDialog> createState() => _VoidPaymentDialogState();
}

class _VoidPaymentDialogState extends State<_VoidPaymentDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(_reason.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final Payment p = widget.payment;
    return AlertDialog(
      title: const Text('Anular pago'),
      content: SizedBox(
        width: 440,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                '${p.method.label} · ${Format.money(p.amount)}',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'El pago se conserva como anulado y su importe deja de contar como pagado. '
                'La devolución del dinero se hace fuera del sistema.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _reason,
                autofocus: true,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Motivo de la anulación *'),
                validator: (String? v) =>
                    Validators.required(v, 'el motivo') ?? Validators.maxLength(v, 255),
              ),
            ],
          ),
        ),
      ),
      actions: <Widget>[
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _submit, child: const Text('Anular pago')),
      ],
    );
  }
}
