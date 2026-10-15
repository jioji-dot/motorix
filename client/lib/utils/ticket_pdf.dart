import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/ticket.dart';
import 'format.dart';

/// Genera en memoria el PDF del ticket a ancho de comprobante (80 mm) con la fuente estándar.
/// Función pura: no escribe archivos ni consulta la red. Solo usa caracteres del juego Latin-1 (admite tildes y la eñe).
Future<Uint8List> buildTicketPdf(Ticket ticket, {bool compress = true}) async {
  final pw.Document documento = pw.Document(
    title: 'Ticket ${ticket.folio}',
    author: ticket.workshop.name,
    compress: compress,
  );

  pw.Widget linea(String izquierda, String derecha, {bool negrita = false}) => pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: <pw.Widget>[
          pw.Expanded(
            child: pw.Text(izquierda,
                style: pw.TextStyle(fontSize: 8, fontWeight: negrita ? pw.FontWeight.bold : pw.FontWeight.normal)),
          ),
          pw.SizedBox(width: 6),
          pw.Text(derecha,
              style: pw.TextStyle(fontSize: 8, fontWeight: negrita ? pw.FontWeight.bold : pw.FontWeight.normal)),
        ],
      );

  pw.Widget titulo(String texto) => pw.Padding(
        padding: const pw.EdgeInsets.only(top: 8, bottom: 3),
        child: pw.Text(texto, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
      );

  pw.Widget separador() => pw.Divider(thickness: 0.5, height: 8);

  pw.Widget centrado(String texto, {double tamano = 8, bool negrita = false}) => pw.Center(
        child: pw.Text(
          texto,
          textAlign: pw.TextAlign.center,
          style: pw.TextStyle(fontSize: tamano, fontWeight: negrita ? pw.FontWeight.bold : pw.FontWeight.normal),
        ),
      );

  documento.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.roll80.copyWith(
        marginLeft: 6 * PdfPageFormat.mm,
        marginRight: 6 * PdfPageFormat.mm,
        marginTop: 6 * PdfPageFormat.mm,
        marginBottom: 6 * PdfPageFormat.mm,
      ),
      build: (pw.Context contexto) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.stretch,
        children: <pw.Widget>[
          centrado(ticket.workshop.name, tamano: 12, negrita: true),
          centrado(ticket.workshop.address),
          centrado('Tel. ${ticket.workshop.phone}'),
          separador(),
          centrado('Ticket ${ticket.folio}', tamano: 10, negrita: true),
          linea('Orden', ticket.orderFolio),
          linea('Fecha de emisión', Format.ticketDate(ticket.issuedAt)),
          linea('Estado de la orden', ticket.orderStatus.label),
          if (ticket.deliveredAt != null) linea('Entregada', Format.ticketDate(ticket.deliveredAt)),
          linea('Atendió', ticket.generatedByName),
          titulo('Cliente'),
          linea(ticket.clientName, ticket.clientPhone ?? ''),
          titulo('Vehículo'),
          linea(ticket.vehicleTitle, ticket.licensePlate),
          linea('Km de entrada', Format.mileage(ticket.entryMileage)),
          if (ticket.serviceMileage != null) linea('Km de servicio', Format.mileage(ticket.serviceMileage!)),
          if (ticket.services.isNotEmpty) ...<pw.Widget>[
            titulo('Servicios'),
            for (final TicketServiceLine s in ticket.services) linea(s.description, Format.money(s.amount)),
            linea('Subtotal', Format.money(ticket.servicesSubtotal), negrita: true),
          ],
          if (ticket.labor.isNotEmpty) ...<pw.Widget>[
            titulo('Mano de obra'),
            for (final TicketLaborLine l in ticket.labor)
              linea('${l.description} (${l.hours} h x ${Format.money(l.hourlyRate)})', Format.money(l.amount)),
            linea('Subtotal', Format.money(ticket.laborSubtotal), negrita: true),
          ],
          if (ticket.parts.isNotEmpty) ...<pw.Widget>[
            titulo('Refacciones'),
            for (final TicketPartLine p in ticket.parts)
              linea('${p.quantity} x ${p.name} (${p.code})', Format.money(p.amount)),
            linea('Subtotal', Format.money(ticket.partsSubtotal), negrita: true),
          ],
          separador(),
          linea('TOTAL', Format.money(ticket.total), negrita: true),
          if (ticket.payments.isNotEmpty) ...<pw.Widget>[
            titulo('Pagos'),
            for (final TicketPayment p in ticket.payments)
              linea(
                '${p.method.label}${p.reference == null ? '' : ' ${p.reference}'}'
                '${p.status.label == 'Aprobado' ? '' : ' (${p.status.label})'}',
                Format.money(p.amount),
              ),
          ],
          separador(),
          linea('Pagado', Format.money(ticket.summary.paid)),
          linea('Saldo', Format.money(ticket.summary.balance), negrita: true),
          linea('Estado del pago', ticket.summary.status.label),
          pw.SizedBox(height: 10),
          centrado('Gracias por su preferencia'),
        ],
      ),
    ),
  );

  return documento.save();
}
