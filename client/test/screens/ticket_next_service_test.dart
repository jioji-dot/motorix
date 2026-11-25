import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Map<String, dynamic> ticketConProximo(Map<String, dynamic>? proximo) => {
      'id': 5,
      'folio': 'TK-000005',
      'generatedAt': '2026-11-25T16:00:00.000Z',
      'workshop': {'name': 'Taller Motorix', 'address': 'Av. Principal 123', 'phone': '5512345678'},
      'order': {'id': 7, 'folio': 'OS-000007', 'status': 'TERMINADO', 'deliveredAt': null},
      'client': {'name': 'Roberto Hernández', 'phone': '5512345601'},
      'vehicle': {'description': 'Nissan Versa 2020', 'licensePlate': 'ABC-123-A', 'mileage': 40000},
      'services': [{'description': 'Aceite', 'amount': '500.00'}],
      'labor': [],
      'parts': [],
      'subtotal': '500.00',
      'total': '500.00',
      'payment': {'methods': ['EFECTIVO'], 'status': 'PAGADA', 'paid': '500.00', 'balance': '0.00'},
      'nextService': proximo,
    };

Future<void> abrirTicket(WidgetTester tester, Map<String, dynamic>? proximo) async {
  final api = ApiAdmin(
    rol: 'RECEPTIONIST',
    aceptado: true,
    ordenes: [ordenJson(7, estado: 'TERMINADO', mechanicId: 3, servicios: [servicioJson(1, 'Aceite', '500.00')])],
  );
  api.sobrescribir = (p) => p.url.path == '/api/orders/7/ticket' ? jsonResponse(p.method == 'POST' ? 201 : 200, {'data': ticketConProximo(proximo)}) : null;
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  final boton = find.byKey(const Key('boton-ticket'));
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  await tester.tap(boton);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('el_ticket_muestra_el_proximo_servicio_con_nombre_fecha_y_kilometraje', (tester) async {
    await abrirTicket(tester, {'name': 'Cambio de aceite', 'date': '2027-05-24', 'mileage': 45000});
    final bloque = find.byKey(const Key('proximo-servicio'));
    await tester.ensureVisible(bloque);
    expect(find.descendant(of: bloque, matching: find.text('Cambio de aceite · 24/05/2027 · 45,000 km')), findsOneWidget);
  });

  testWidgets('con_solo_kilometraje_o_solo_fecha_muestra_el_dato_disponible', (tester) async {
    await abrirTicket(tester, {'name': 'Afinación', 'date': null, 'mileage': 50000});
    expect(find.text('Afinación · 50,000 km'), findsOneWidget);
  });

  testWidgets('sin_proximo_servicio_la_linea_no_aparece', (tester) async {
    await abrirTicket(tester, null);
    expect(find.byKey(const Key('proximo-servicio')), findsNothing);
    expect(find.text('Próximo servicio'), findsNothing);
  });
}
