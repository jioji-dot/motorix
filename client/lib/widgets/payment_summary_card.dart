import 'package:flutter/material.dart';

import '../models/payment.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'status_chip.dart';

/// Resumen de cobro de una orden: total, pagado, pendiente, saldo y chip del estado de pago.
class PaymentSummaryCard extends StatelessWidget {
  const PaymentSummaryCard({super.key, required this.summary});

  final PaymentSummary summary;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;

    Widget dato(String etiqueta, double valor, {bool destacar = false}) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(etiqueta, style: text.bodySmall),
              const SizedBox(height: AppSpacing.xs),
              Text(Format.money(valor), style: destacar ? text.titleLarge : text.titleMedium),
            ],
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text('Estado del pago', style: text.bodySmall),
            const SizedBox(width: AppSpacing.md),
            StatusChip(label: summary.status.label, color: summary.status.color),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            dato('Total', summary.total),
            dato('Pagado', summary.paid),
            if (summary.pending > 0) dato('Pendiente de Mercado Pago', summary.pending),
            dato('Saldo', summary.balance, destacar: true),
          ],
        ),
      ],
    );
  }
}
