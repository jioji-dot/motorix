import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/ticket.dart';
import 'package:motorix_client/utils/ticket_pdf.dart';

import 'helpers/fake_api.dart';

void main() {
  test('test_el_pdf_empieza_con_la_cabecera_y_no_esta_vacio', () async {
    final List<int> bytes = await buildTicketPdf(Ticket.fromJson(ticketJson()));

    expect(bytes, isNotEmpty);
    expect(latin1.decode(bytes.take(5).toList()), '%PDF-');
  });

  test('test_el_pdf_sin_comprimir_contiene_el_folio_y_el_total', () async {
    final List<int> bytes = await buildTicketPdf(Ticket.fromJson(ticketJson()), compress: false);
    final String texto = latin1.decode(bytes);

    expect(texto, contains('TK-000003'));
    expect(texto, contains('1,705.00'));
    expect(texto, contains('OS-000005'));
    expect(texto, contains('AUT-4521'));
  });

  test('test_el_pdf_funciona_con_una_orden_sin_pagos_ni_kilometraje_de_servicio', () async {
    final Map<String, dynamic> json = ticketJson(
      orderStatus: 'TERMINADO',
      payments: <Map<String, dynamic>>[],
      summary: paymentSummaryJson(total: 1705, status: 'UNPAID'),
    );
    (json['vehicle'] as Map<String, dynamic>)['serviceMileage'] = null;

    final List<int> bytes = await buildTicketPdf(Ticket.fromJson(json));

    expect(latin1.decode(bytes.take(5).toList()), '%PDF-');
  });
}
