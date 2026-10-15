import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/order_status.dart';

import 'helpers/fake_api.dart';

Future<void> iniciarSesion(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(2400, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

http.Response? Function(RecordedRequest) manejador({List<Map<String, dynamic>>? ordenes}) {
  return (RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(ordenes ?? <Map<String, dynamic>>[]);
    }
    if (r.path == '/mechanics') {
      return jsonData(<Map<String, dynamic>>[
        <String, dynamic>{'id': 21, 'name': 'Mario Mecánico', 'username': 'mario'},
      ]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') {
      return jsonData(orderJson(id: 5, folio: 'OS-000005', status: 'DIAGNOSTICO', mechanicId: 21, mechanicName: 'Mario Mecánico'));
    }
    return null;
  };
}

final List<Map<String, dynamic>> ordenesDeEjemplo = <Map<String, dynamic>>[
  orderJson(
    id: 5,
    folio: 'OS-000005',
    status: 'DIAGNOSTICO',
    mechanicId: 21,
    mechanicName: 'Mario Mecánico',
    reportedProblem: 'Ruido al frenar',
    total: 1150.5,
  ),
  orderJson(
    id: 6,
    folio: 'OS-000006',
    status: 'TERMINADO',
    clientName: 'Luis Gómez',
    vehiclePlate: 'XYZ987',
    reportedProblem: 'Cambio de aceite',
  ),
];

void main() {
  testWidgets('test_el_mecanico_ve_mis_ordenes_sin_columna_de_mecanico_ni_boton_de_alta',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador(ordenes: ordenesDeEjemplo)));
    await iniciarSesion(tester, api);

    expect(find.text('Mis órdenes'), findsWidgets);
    expect(find.text('OS-000005'), findsOneWidget);
    expect(find.text('Ruido al frenar'), findsOneWidget);
    expect(find.text('Diagnóstico'), findsWidgets);
    expect(find.text('Terminado'), findsWidgets);
    expect(find.text('Mecánico'), findsWidgets, reason: 'solo el rol en el encabezado y el menú');
    expect(find.text('Nueva orden'), findsNothing);
    expect(find.text('Usuarios'), findsNothing);
  });

  testWidgets('test_el_mecanico_sin_ordenes_ve_un_mensaje_claro', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador()));
    await iniciarSesion(tester, api);

    expect(find.text('No tienes órdenes asignadas por ahora.'), findsOneWidget);
    expect(find.text('Crear la primera orden'), findsNothing);
  });

  testWidgets('test_la_recepcionista_ve_todas_con_columna_de_mecanico_total_y_alta', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador(ordenes: ordenesDeEjemplo)));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Órdenes'));
    await tester.pumpAndSettle();

    expect(find.text('Órdenes de servicio'), findsOneWidget);
    expect(find.text('Mario Mecánico'), findsWidgets);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text(r'$1,150.50'), findsOneWidget);
    expect(find.text('Nueva orden'), findsOneWidget);
    expect(find.text('Mecánico'), findsWidgets);
  });

  testWidgets('test_sin_ordenes_la_recepcion_puede_crear_la_primera', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador()));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Órdenes'));
    await tester.pumpAndSettle();

    expect(find.text('Aún no hay órdenes de servicio.'), findsOneWidget);
    expect(find.text('Crear la primera orden'), findsOneWidget);
  });

  testWidgets('test_filtra_por_estado_y_por_mecanico_enviando_los_parametros', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador(ordenes: ordenesDeEjemplo)));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Órdenes'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<OrderStatus?>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Terminado').last);
    await tester.pumpAndSettle();

    final RecordedRequest ultima =
        api.requests.lastWhere((RecordedRequest r) => r.path == '/orders' && r.method == 'GET');
    expect(ultima.query['status'], 'TERMINADO');
  });

  testWidgets('test_al_tocar_una_fila_abre_el_detalle_de_la_orden', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador(ordenes: ordenesDeEjemplo)));
    await iniciarSesion(tester, api);

    await tester.tap(find.text('OS-000005'));
    await tester.pumpAndSettle();

    expect(find.text('Detalle de la orden'), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.path == '/orders/5'), isTrue);
  });
}
