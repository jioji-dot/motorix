import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/payment.dart';
import '../utils/format.dart';
import 'status_chip.dart';

/// Tabla de pagos de una orden. Las acciones solo aparecen cuando el servidor las permite
/// (`canCancel`, `canVoid`, `canRefresh`) y el llamador entrega el callback correspondiente.
class PaymentsTable extends StatelessWidget {
  const PaymentsTable({
    super.key,
    required this.payments,
    this.onCancel,
    this.onVoid,
    this.onRefresh,
    this.onOpenLink,
  });

  final List<Payment> payments;
  final ValueChanged<Payment>? onCancel;
  final ValueChanged<Payment>? onVoid;
  final ValueChanged<Payment>? onRefresh;
  final ValueChanged<Payment>? onOpenLink;

  @override
  Widget build(BuildContext context) {
    if (payments.isEmpty) {
      return Text('Aún no hay pagos registrados.', style: Theme.of(context).textTheme.bodySmall);
    }
    final bool hayAcciones = payments.any(
      (Payment p) =>
          (p.canCancel && onCancel != null) ||
          (p.canVoid && onVoid != null) ||
          (p.canRefresh && onRefresh != null) ||
          (p.paymentUrl != null && p.status == PaymentStatus.pending && onOpenLink != null),
    );

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: constraints.maxWidth),
          child: DataTable(
            showCheckboxColumn: false,
            columns: <DataColumn>[
              const DataColumn(label: Text('Fecha')),
              const DataColumn(label: Text('Método')),
              const DataColumn(label: Text('Importe'), numeric: true),
              const DataColumn(label: Text('Estado')),
              const DataColumn(label: Text('Referencia')),
              const DataColumn(label: Text('Registró')),
              if (hayAcciones) const DataColumn(label: Text('Acciones')),
            ],
            rows: <DataRow>[
              for (final Payment p in payments)
                DataRow(cells: <DataCell>[
                  DataCell(Text(Format.instant(p.createdAt))),
                  DataCell(Text(p.method.label)),
                  DataCell(Text(Format.money(p.amount))),
                  DataCell(Tooltip(
                    message: p.status == PaymentStatus.voided && p.voidReason != null
                        ? 'Motivo: ${p.voidReason} (${Format.orDash(p.voidedByName)})'
                        : p.status.label,
                    child: StatusChip(label: p.status.label, color: p.status.color),
                  )),
                  DataCell(Text(Format.orDash(p.reference ?? p.externalReference))),
                  DataCell(Text(p.createdByName)),
                  if (hayAcciones) DataCell(_Acciones(pago: p, tabla: this)),
                ]),
            ],
          ),
        ),
      ),
    );
  }
}

class _Acciones extends StatelessWidget {
  const _Acciones({required this.pago, required this.tabla});

  final Payment pago;
  final PaymentsTable tabla;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (pago.canRefresh && tabla.onRefresh != null)
          IconButton(
            tooltip: 'Actualizar estado',
            icon: const Icon(LucideIcons.refreshCw, size: 18),
            onPressed: () => tabla.onRefresh!(pago),
          ),
        if (pago.paymentUrl != null && pago.status == PaymentStatus.pending && tabla.onOpenLink != null)
          IconButton(
            tooltip: 'Abrir enlace de pago',
            icon: const Icon(LucideIcons.externalLink, size: 18),
            onPressed: () => tabla.onOpenLink!(pago),
          ),
        if (pago.canCancel && tabla.onCancel != null)
          IconButton(
            tooltip: 'Cancelar cobro',
            icon: const Icon(LucideIcons.ban, size: 18),
            onPressed: () => tabla.onCancel!(pago),
          ),
        if (pago.canVoid && tabla.onVoid != null)
          IconButton(
            tooltip: 'Anular pago',
            icon: const Icon(LucideIcons.undo2, size: 18),
            onPressed: () => tabla.onVoid!(pago),
          ),
      ],
    );
  }
}
