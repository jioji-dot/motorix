import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/payment.dart';

import 'helpers/fake_api.dart';

Future<void> abrirPagos(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(1800, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Pagos')));
  await tester.pumpAndSettle();
}

http.Response listado(List<Map<String, dynamic>> items, {double approvedTotal = 0}) => jsonData(
      items,
      meta: <String, dynamic>{
        'page': 1,
        'pageSize': 20,
        'total': items.length,
        'approvedTotal': approvedTotal,
      },
    );

FakeHandler manejador(http.Response Function(RecordedRequest) pagos, {String role = 'RECEPTIONIST'}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        if (r.path == '/payments' && r.method == 'GET') return pagos(r);
        return null;
      },
    );

void main() {
  testWidgets('test_lista_pagos_con_orden_cliente_metodo_estado_y_total_aprobado', (WidgetTester tester) async {
    final FakeApi api = FakeApi(manejador((RecordedRequest r) => listado(
          <Map<String, dynamic>>[
            paymentJson(id: 1, orderFolio: 'OS-000005', clientName: 'Ana Pérez', amount: 500),
            paymentJson(id: 2, orderFolio: 'OS-000006', clientName: 'Luis Gómez', method: 'CARD', amount: 250, status: 'ANULADO'),
          ],
          approvedTotal: 500,
        )));
    await abrirPagos(tester, api);

    expect(find.text('OS-000005'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('Tarjeta'), findsOneWidget);
    expect(find.text('Anulado'), findsOneWidget);
    expect(find.text('Total aprobado con estos filtros: \$500.00'), findsOneWidget);
  });

  testWidgets('test_muestra_estado_vacio_cuando_no_hay_pagos', (WidgetTester tester) async {
    final FakeApi api = FakeApi(manejador((RecordedRequest r) => listado(<Map<String, dynamic>>[])));
    await abrirPagos(tester, api);

    expect(find.text('Aún no hay pagos registrados.'), findsOneWidget);
  });

  testWidgets('test_filtra_por_estado_enviando_el_valor_al_servidor', (WidgetTester tester) async {
    final FakeApi api = FakeApi(manejador((RecordedRequest r) => listado(<Map<String, dynamic>>[paymentJson()])));
    await abrirPagos(tester, api);

    await tester.tap(find.byType(DropdownButtonFormField<PaymentStatus?>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Anulado').last);
    await tester.pumpAndSettle();

    final RecordedRequest ultima = api.requests.lastWhere((RecordedRequest r) => r.path == '/payments');
    expect(ultima.query['status'], 'ANULADO');
  });

  testWidgets('test_muestra_el_error_del_servidor_y_permite_reintentar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(manejador(
      (RecordedRequest r) => jsonError(500, 'INTERNAL_ERROR', 'No se pudieron cargar los pagos.'),
    ));
    await abrirPagos(tester, api);

    expect(find.text('No se pudieron cargar los pagos.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('test_el_mecanico_no_tiene_entrada_de_pagos_en_el_menu', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1800, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    final FakeApi api = FakeApi(manejador((RecordedRequest r) => listado(<Map<String, dynamic>>[]), role: 'MECHANIC'));

    await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
    await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();

    expect(find.descendant(of: find.byType(NavigationRail), matching: find.text('Pagos')), findsNothing);
  });
}
