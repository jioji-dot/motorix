import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/ticket.dart';
import 'package:motorix_client/widgets/ticket_view.dart';

import 'helpers/fake_api.dart';

Future<void> _mostrar(WidgetTester tester, Ticket ticket) async {
  tester.view.physicalSize = const Size(1000, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(MaterialApp(
    home: Scaffold(body: SingleChildScrollView(child: TicketView(ticket: ticket))),
  ));
}

void main() {
  test('test_el_ticket_interpreta_el_contrato_completo', () {
    final Ticket t = Ticket.fromJson(ticketJson());

    expect(t.folio, 'TK-000003');
    expect(t.orderFolio, 'OS-000005');
    expect(t.vehicleTitle, 'Nissan Versa');
    expect(t.total, 1705);
    expect(t.servicesSubtotal, 450);
    expect(t.laborSubtotal, 875);
    expect(t.partsSubtotal, 380);
    expect(t.payments.single.reference, 'AUT-4521');
    expect(t.summary.balance, 705);
  });

  testWidgets('test_muestra_taller_folios_cliente_y_vehiculo', (WidgetTester tester) async {
    await _mostrar(tester, Ticket.fromJson(ticketJson()));

    expect(find.text('Motorix Taller Mecánico'), findsOneWidget);
    expect(find.text('Av. Principal 123, Ciudad de México'), findsOneWidget);
    expect(find.text('Tel. 5555123456'), findsOneWidget);
    expect(find.text('Ticket TK-000003'), findsOneWidget);
    expect(find.text('OS-000005'), findsOneWidget);
    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('Nissan Versa'), findsOneWidget);
    expect(find.text('PRD482A'), findsOneWidget);
    expect(find.text('47,000 km'), findsOneWidget);
    expect(find.text('47,150 km'), findsOneWidget);
  });

  testWidgets('test_muestra_lineas_subtotales_y_total', (WidgetTester tester) async {
    await _mostrar(tester, Ticket.fromJson(ticketJson()));

    expect(find.text('Afinación mayor'), findsOneWidget);
    expect(find.textContaining('Cambio de bujías'), findsOneWidget);
    expect(find.textContaining('Bujía de iridio'), findsOneWidget);
    expect(find.text('Subtotal de servicios'), findsOneWidget);
    expect(find.text('\$450.00'), findsNWidgets(2), reason: 'línea y subtotal de servicios');
    expect(find.text('\$875.00'), findsNWidgets(2));
    expect(find.text('\$380.00'), findsNWidgets(2));
    expect(find.text('\$1,705.00'), findsOneWidget);
  });

  testWidgets('test_muestra_pagos_pagado_saldo_y_estado_de_pago', (WidgetTester tester) async {
    await _mostrar(tester, Ticket.fromJson(ticketJson()));

    expect(find.textContaining('Tarjeta · AUT-4521'), findsOneWidget);
    expect(find.text('Pagado'), findsOneWidget);
    expect(find.text('\$705.00'), findsOneWidget, reason: 'saldo pendiente');
    expect(find.text('Pago parcial'), findsOneWidget);
  });

  testWidgets('test_un_cobro_pendiente_se_marca_en_el_comprobante', (WidgetTester tester) async {
    await _mostrar(
      tester,
      Ticket.fromJson(ticketJson(
        payments: <Map<String, dynamic>>[
          <String, dynamic>{
            'method': 'MERCADO_PAGO',
            'amount': 300.0,
            'status': 'PENDIENTE',
            'reference': null,
            'createdAt': '2026-10-14T14:00:00.000Z',
          },
        ],
        summary: paymentSummaryJson(total: 1705, paid: 0, pending: 300, status: 'UNPAID'),
      )),
    );

    expect(find.text('Pendiente'), findsOneWidget);
    expect(find.text('Sin pagar'), findsOneWidget);
  });

  testWidgets('test_sin_pagos_no_muestra_la_seccion_de_pagos', (WidgetTester tester) async {
    await _mostrar(
      tester,
      Ticket.fromJson(ticketJson(
        payments: <Map<String, dynamic>>[],
        summary: paymentSummaryJson(total: 1705, status: 'UNPAID'),
      )),
    );

    expect(find.text('Pagos'), findsNothing);
    expect(find.text('Sin pagar'), findsOneWidget);
  });
}
