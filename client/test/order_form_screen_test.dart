import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> iniciarSesion(WidgetTester tester, FakeApi api) async {
  // La fuente de prueba es más ancha que la real: se usa una ventana amplia para ver todas las columnas.
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

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

http.Response? Function(RecordedRequest) manejador({
  void Function(RecordedRequest)? alCrear,
  http.Response Function(RecordedRequest)? respuestaAlta,
  bool conCita = false,
}) {
  return (RecordedRequest r) {
    if (r.path == '/clients' && r.method == 'GET' && r.query['search'] == 'ana') {
      return listOf(<Map<String, dynamic>>[clientJson(id: 7, name: 'Ana Pérez')]);
    }
    if (r.path == '/clients/7') {
      return jsonData(clientJson(
        id: 7,
        name: 'Ana Pérez',
        vehicles: <Map<String, dynamic>>[
          vehicleJson(id: 3, clientId: 7, licensePlate: 'ABC123', brand: 'Nissan', model: 'Versa'),
        ],
      ));
    }
    if (conCita && r.path == '/appointments' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[
        appointmentJson(id: 11, clientId: 7, vehicleId: 3, reason: 'Revisión de frenos'),
        appointmentJson(id: 12, clientId: 7, vehicleId: 3, reason: 'Cita con orden', status: 'EN_PROCESO', orderId: 5),
      ]);
    }
    if (r.path == '/orders/1' && r.method == 'GET') {
      return jsonData(orderJson());
    }
    if (r.path == '/orders' && r.method == 'POST') {
      alCrear?.call(r);
      return respuestaAlta?.call(r) ?? jsonData(orderJson(), status: 201);
    }
    return null;
  };
}

Future<void> irANuevaOrdenDesdeCero(WidgetTester tester) async {
  // La pantalla de órdenes se agrega en una historia posterior: se abre el formulario por la cita.
  await tester.tap(find.text('Citas'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_solo_las_citas_abiertas_sin_orden_ofrecen_crear_orden', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador(conCita: true)));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);

    expect(find.byTooltip('Crear orden de servicio'), findsOneWidget);
  });

  testWidgets('test_precarga_cliente_vehiculo_y_motivo_desde_la_cita', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador(conCita: true)));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);

    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();

    expect(find.text('Nueva orden'), findsOneWidget);
    expect(find.textContaining('Desde la cita del'), findsOneWidget);
    expect(find.text('Revisión de frenos'), findsOneWidget);
    expect(find.text('Ana Pérez'), findsWidgets);
  });

  testWidgets('test_no_guarda_si_falta_el_kilometraje_o_el_problema', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador(conCita: true)));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);
    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Problema reportado *'), '');

    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    expect(find.text('Ingresa el kilometraje de entrada.'), findsOneWidget);
    expect(find.text('Ingresa el problema reportado.'), findsOneWidget);
    expect(api.requests.where((RecordedRequest r) => r.method == 'POST' && r.path == '/orders'), isEmpty);
  });

  testWidgets('test_rechaza_un_kilometraje_negativo_o_decimal', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador(conCita: true)));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);
    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada *'), '-5');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    expect(find.text('El kilometraje debe ser un número entero no negativo.'), findsOneWidget);
  });

  testWidgets('test_crea_la_orden_desde_la_cita_enviando_solo_el_identificador_de_la_cita',
      (WidgetTester tester) async {
    RecordedRequest? alta;
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(conCita: true, alCrear: (RecordedRequest r) => alta = r),
    ));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);
    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada *'), '15000');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    expect(alta, isNotNull);
    expect(alta!.body!['appointmentId'], 11);
    expect(alta!.body!.containsKey('clientId'), isFalse);
    expect(alta!.body!.containsKey('vehicleId'), isFalse);
    expect(alta!.body!['entryMileage'], 15000);
    expect(alta!.body!['reportedProblem'], 'Revisión de frenos');
    expect(find.text('Orden OS-000001 registrada correctamente.'), findsOneWidget);
    expect(find.text('Detalle de la orden'), findsOneWidget, reason: 'abre el detalle de la orden creada');
  });

  testWidgets('test_pide_confirmar_la_correccion_cuando_el_kilometraje_es_menor',
      (WidgetTester tester) async {
    final List<Map<String, dynamic>> cuerpos = <Map<String, dynamic>>[];
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        conCita: true,
        alCrear: (RecordedRequest r) => cuerpos.add(r.body!),
        respuestaAlta: (RecordedRequest r) {
          if (r.body!['mileageCorrection'] == true) return jsonData(orderJson(), status: 201);
          return jsonError(409, 'MILEAGE_DECREASE', 'El kilometraje no puede ser menor al registrado.',
              details: <String, dynamic>{'field': 'currentMileage'});
        },
      ),
    ));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);
    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada *'), '100');

    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    expect(find.text('Kilometraje menor al registrado'), findsOneWidget);

    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(cuerpos, hasLength(2));
    expect(cuerpos.last['mileageCorrection'], isTrue);
    expect(find.text('Orden OS-000001 registrada correctamente.'), findsOneWidget);
  });

  testWidgets('test_no_corrige_el_kilometraje_si_el_usuario_cancela', (WidgetTester tester) async {
    int altas = 0;
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        conCita: true,
        alCrear: (RecordedRequest r) => altas++,
        respuestaAlta: (RecordedRequest r) =>
            jsonError(409, 'MILEAGE_DECREASE', 'El kilometraje no puede ser menor al registrado.'),
      ),
    ));
    await iniciarSesion(tester, api);
    await irANuevaOrdenDesdeCero(tester);
    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Kilometraje de entrada *'), '100');
    await tester.tap(find.text('Crear orden'));
    await tester.pumpAndSettle();

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(altas, 1);
    expect(find.textContaining('registrada correctamente'), findsNothing);
  });
}
