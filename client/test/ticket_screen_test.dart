import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api, {String role = 'RECEPTIONIST'}) async {
  tester.view.physicalSize = const Size(2400, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (role != 'MECHANIC') {
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Órdenes')));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

/// Servidor falso de una orden con ticket opcional.
class _Servidor {
  _Servidor({this.status = 'ENTREGADO', this.ticketId});

  String status;
  int? ticketId;
  int generaciones = 0;
  http.Response? errorAlGenerar;
  bool falloAlCargarTicket = false;

  http.Response? responder(RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005', status: status, total: 1705)]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') {
      return jsonData(orderJson(
        id: 5,
        folio: 'OS-000005',
        status: status,
        total: 1705,
        ticketId: ticketId,
        payment: paymentSummaryJson(total: 1705, paid: 1000, status: 'PARTIAL'),
      ));
    }
    if (r.path == '/orders/5/payments' && r.method == 'GET') {
      return jsonData(<String, dynamic>{
        'summary': paymentSummaryJson(total: 1705, paid: 1000, status: 'PARTIAL'),
        'payments': <Map<String, dynamic>>[],
      });
    }
    if (r.path == '/orders/5/ticket' && r.method == 'POST') {
      generaciones++;
      if (errorAlGenerar != null) return errorAlGenerar;
      final bool nuevo = ticketId == null;
      ticketId = 3;
      return jsonData(ticketJson(id: 3), status: nuevo ? 201 : 200);
    }
    if (r.path == '/tickets/3' && r.method == 'GET') {
      if (falloAlCargarTicket) return jsonError(500, 'INTERNAL_ERROR', 'No se pudo cargar el ticket.');
      return jsonData(ticketJson(id: 3));
    }
    return null;
  }
}

void main() {
  testWidgets('test_genera_el_ticket_y_lo_muestra_con_sus_datos_y_el_boton_imprimir', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Generar ticket'));
    await tester.pumpAndSettle();

    expect(servidor.generaciones, 1);
    expect(find.text('Ticket TK-000003'), findsOneWidget);
    expect(find.text('Motorix Taller Mecánico'), findsOneWidget);
    expect(find.text('Imprimir'), findsOneWidget);
    expect(find.text('\$1,705.00'), findsOneWidget);
  });

  testWidgets('test_si_la_orden_ya_tiene_ticket_ofrece_verlo_sin_generar_otro', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor(ticketId: 3);
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    expect(find.text('Generar ticket'), findsNothing);
    await tester.tap(find.text('Ver ticket'));
    await tester.pumpAndSettle();

    expect(servidor.generaciones, 0, reason: 'abrir un ticket existente no llama a generar');
    expect(find.text('Ticket TK-000003'), findsOneWidget);
  });

  testWidgets('test_el_boton_funciona_tambien_con_la_orden_terminada', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor(status: 'TERMINADO');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    expect(find.text('Generar ticket'), findsOneWidget);
  });

  testWidgets('test_no_ofrece_ticket_si_la_orden_no_esta_terminada_ni_entregada', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor(status: 'EN_REPARACION');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    expect(find.text('Generar ticket'), findsNothing);
    expect(find.text('Ver ticket'), findsNothing);
  });

  testWidgets('test_el_mecanico_no_ve_el_boton_de_ticket', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: servidor.responder));
    await abrirOrden(tester, api, role: 'MECHANIC');

    expect(find.text('Generar ticket'), findsNothing);
    expect(find.text('Ver ticket'), findsNothing);
  });

  testWidgets('test_muestra_el_error_del_servidor_al_generar', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor()
      ..errorAlGenerar = jsonError(409, 'TICKET_ORDER_NOT_READY', 'El ticket se genera cuando la orden está terminada o entregada.');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Generar ticket'));
    await tester.pumpAndSettle();

    expect(find.text('El ticket se genera cuando la orden está terminada o entregada.'), findsOneWidget);
    expect(find.text('Imprimir'), findsNothing);
  });

  testWidgets('test_error_al_cargar_el_ticket_ofrece_reintentar', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor(ticketId: 3)..falloAlCargarTicket = true;
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Ver ticket'));
    await tester.pumpAndSettle();

    expect(find.text('No se pudo cargar el ticket.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);

    servidor.falloAlCargarTicket = false;
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Ticket TK-000003'), findsOneWidget);
  });
}
