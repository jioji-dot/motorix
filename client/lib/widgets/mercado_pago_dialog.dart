import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/payment.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'state_views.dart';

/// Muestra el cobro de Mercado Pago recién creado: importe reservado y enlace de pago, con
/// "Abrir enlace" y "Copiar enlace". El pago se completa en la página de Mercado Pago; el sistema
/// nunca pide ni guarda datos de tarjeta.
Future<void> showMercadoPagoLinkDialog(
  BuildContext context, {
  required Payment payment,
  required Future<void> Function(Payment payment) onOpen,
}) {
  return showDialog<void>(
    context: context,
    builder: (BuildContext contexto) => _MercadoPagoLinkDialog(payment: payment, onOpen: onOpen),
  );
}

class _MercadoPagoLinkDialog extends StatelessWidget {
  const _MercadoPagoLinkDialog({required this.payment, required this.onOpen});

  final Payment payment;
  final Future<void> Function(Payment payment) onOpen;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final String enlace = payment.paymentUrl ?? '';
    return AlertDialog(
      title: const Text('Cobro de Mercado Pago creado'),
      content: SizedBox(
        width: 480,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Importe reservado: ${Format.money(payment.amount)}', style: text.titleMedium),
            const SizedBox(height: AppSpacing.md),
            const Text('Comparte este enlace con el cliente para que pague en la página de Mercado Pago:'),
            const SizedBox(height: AppSpacing.sm),
            SelectableText(enlace, style: text.bodySmall),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'El pago se completa en la página de Mercado Pago (modo de pruebas); aquí nunca se piden '
              'datos de tarjeta. Cuando el cliente pague, usa «Actualizar estado» en la tabla de pagos.',
              style: text.bodySmall,
            ),
          ],
        ),
      ),
      actions: <Widget>[
        TextButton.icon(
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: enlace));
            if (context.mounted) showAppSnackBar(context, 'Enlace copiado.');
          },
          icon: const Icon(LucideIcons.copy, size: 16),
          label: const Text('Copiar enlace'),
        ),
        OutlinedButton.icon(
          onPressed: () => onOpen(payment),
          icon: const Icon(LucideIcons.externalLink, size: 16),
          label: const Text('Abrir enlace'),
        ),
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Listo')),
      ],
    );
  }
}
