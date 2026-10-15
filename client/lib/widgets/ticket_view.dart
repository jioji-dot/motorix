import 'package:flutter/material.dart';

import '../models/payment.dart';
import '../models/ticket.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'panel.dart';
import 'status_chip.dart';

/// Comprobante en pantalla: datos del taller, folio, cliente, vehículo, líneas, subtotales, total,
/// pagos y estado de pago. Es el mismo contenido que el PDF para imprimir.
class TicketView extends StatelessWidget {
  const TicketView({super.key, required this.ticket});

  final Ticket ticket;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;

    Widget fila(String izquierda, String derecha, {TextStyle? estilo}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(child: Text(izquierda, style: estilo ?? text.bodyMedium)),
              const SizedBox(width: AppSpacing.md),
              Text(derecha, style: estilo ?? text.bodyMedium),
            ],
          ),
        );

    Widget seccion(String titulo, List<Widget> hijos) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const SizedBox(height: AppSpacing.lg),
            Text(titulo, style: text.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            ...hijos,
          ],
        );

    return Panel(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(ticket.workshop.name, textAlign: TextAlign.center, style: text.headlineSmall),
          const SizedBox(height: AppSpacing.xs),
          Text(ticket.workshop.address, textAlign: TextAlign.center, style: text.bodySmall),
          Text('Tel. ${ticket.workshop.phone}', textAlign: TextAlign.center, style: text.bodySmall),
          const Divider(height: AppSpacing.xl),
          Text('Ticket ${ticket.folio}', textAlign: TextAlign.center, style: text.titleLarge),
          const SizedBox(height: AppSpacing.sm),
          fila('Orden', ticket.orderFolio),
          fila('Fecha de emisión', Format.ticketDate(ticket.issuedAt)),
          fila('Estado de la orden', ticket.orderStatus.label),
          if (ticket.deliveredAt != null) fila('Entregada', Format.ticketDate(ticket.deliveredAt)),
          fila('Atendió', ticket.generatedByName),
          seccion('Cliente', <Widget>[
            fila(ticket.clientName, ticket.clientPhone ?? ''),
          ]),
          seccion('Vehículo', <Widget>[
            fila(ticket.vehicleTitle, ticket.licensePlate),
            fila('Kilometraje de entrada', Format.mileage(ticket.entryMileage)),
            if (ticket.serviceMileage != null)
              fila('Kilometraje de servicio', Format.mileage(ticket.serviceMileage!)),
          ]),
          if (ticket.services.isNotEmpty)
            seccion('Servicios', <Widget>[
              for (final TicketServiceLine s in ticket.services) fila(s.description, Format.money(s.amount)),
              fila('Subtotal de servicios', Format.money(ticket.servicesSubtotal), estilo: text.titleSmall),
            ]),
          if (ticket.labor.isNotEmpty)
            seccion('Mano de obra', <Widget>[
              for (final TicketLaborLine l in ticket.labor)
                fila('${l.description} (${l.hours} h × ${Format.money(l.hourlyRate)})', Format.money(l.amount)),
              fila('Subtotal de mano de obra', Format.money(ticket.laborSubtotal), estilo: text.titleSmall),
            ]),
          if (ticket.parts.isNotEmpty)
            seccion('Refacciones', <Widget>[
              for (final TicketPartLine p in ticket.parts)
                fila('${p.quantity} × ${p.name} (${p.code})', Format.money(p.amount)),
              fila('Subtotal de refacciones', Format.money(ticket.partsSubtotal), estilo: text.titleSmall),
            ]),
          const Divider(height: AppSpacing.xl),
          fila('Total', Format.money(ticket.total), estilo: text.titleLarge),
          if (ticket.payments.isNotEmpty)
            seccion('Pagos', <Widget>[
              for (final TicketPayment p in ticket.payments)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          '${p.method.label}${p.reference == null ? '' : ' · ${p.reference}'} · ${Format.ticketDate(p.createdAt)}',
                          style: text.bodyMedium,
                        ),
                      ),
                      if (p.status != PaymentStatus.approved) ...<Widget>[
                        StatusChip(label: p.status.label, color: p.status.color),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                      Text(Format.money(p.amount), style: text.bodyMedium),
                    ],
                  ),
                ),
            ]),
          const Divider(height: AppSpacing.xl),
          fila('Pagado', Format.money(ticket.summary.paid)),
          fila('Saldo', Format.money(ticket.summary.balance), estilo: text.titleMedium),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              children: <Widget>[
                Expanded(child: Text('Estado del pago', style: text.bodyMedium)),
                StatusChip(label: ticket.summary.status.label, color: ticket.summary.status.color),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
