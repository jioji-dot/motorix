import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> iniciarSesion(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

Future<void> irANuevaCita(WidgetTester tester) async {
  await tester.tap(find.text('Citas'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Nueva cita'));
  await tester.pumpAndSettle();
}

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

http.Response? Function(RecordedRequest) conCliente({
  void Function(RecordedRequest)? alCrear,
  http.Response Function(RecordedRequest)? respuestaAlta,
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
    if (r.path == '/appointments' && r.method == 'POST') {
      alCrear?.call(r);
      return respuestaAlta?.call(r) ?? jsonData(appointmentJson(clientId: 7, vehicleId: 3), status: 201);
    }
    return null;
  };
}

Future<void> elegirClienteYVehiculo(WidgetTester tester) async {
  await tester.enterText(find.widgetWithText(TextField, 'Cliente *'), 'ana');
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Ana Pérez'));
  await tester.pumpAndSettle();
  await tester.tap(find.byType(DropdownButtonFormField<int>));
  await tester.pumpAndSettle();
  await tester.tap(find.text('ABC123 · Nissan Versa (2020)').last);
  await tester.pumpAndSettle();
}

Future<void> elegirFechaYHora(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(TextFormField, 'Fecha y hora *'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Aceptar'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Aceptar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_el_listado_muestra_las_citas_con_su_estado', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/appointments' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[
          appointmentJson(id: 1, reason: 'Cambio de aceite', status: 'PENDIENTE'),
          appointmentJson(id: 2, reason: 'Frenos', status: 'CONFIRMADA', clientName: 'Luis Gómez'),
        ]);
      }
      return null;
    }));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Citas'));
    await tester.pumpAndSettle();

    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('Pendiente'), findsWidgets);
    expect(find.text('Confirmada'), findsWidgets);
    expect(find.text('10/01/2030 10:00'), findsWidgets);
  });

  testWidgets('test_el_listado_vacio_sugiere_registrar_la_primera_cita', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Citas'));
    await tester.pumpAndSettle();

    expect(find.text('Aún no hay citas registradas.'), findsOneWidget);
    expect(find.text('Registrar la primera cita'), findsOneWidget);
  });

  testWidgets('test_no_guarda_si_faltan_cliente_vehiculo_fecha_y_motivo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await iniciarSesion(tester, api);
    await irANuevaCita(tester);

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Selecciona al cliente.'), findsOneWidget);
    expect(find.text('Elige la fecha y la hora.'), findsOneWidget);
    expect(find.text('Ingresa el motivo.'), findsOneWidget);
    expect(
      api.requests.where((RecordedRequest r) => r.method == 'POST' && r.path == '/appointments'),
      isEmpty,
    );
  });

  testWidgets('test_registra_una_cita_eligiendo_cliente_vehiculo_fecha_y_hora', (WidgetTester tester) async {
    RecordedRequest? alta;
    final FakeApi api = FakeApi(baseHandler(extra: conCliente(alCrear: (RecordedRequest r) => alta = r)));
    await iniciarSesion(tester, api);
    await irANuevaCita(tester);

    await elegirClienteYVehiculo(tester);
    await elegirFechaYHora(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo *'), 'Cambio de aceite');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(alta, isNotNull);
    expect(alta!.body!['clientId'], 7);
    expect(alta!.body!['vehicleId'], 3);
    expect(alta!.body!['reason'], 'Cambio de aceite');
    expect(alta!.body!['scheduledAt'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$')));
    expect(find.text('Cita registrada correctamente.'), findsOneWidget);
  });

  testWidgets('test_pide_confirmacion_cuando_hay_una_cita_coincidente_y_guarda_si_se_confirma',
      (WidgetTester tester) async {
    int altas = 0;
    final FakeApi api = FakeApi(baseHandler(extra: conCliente(
      alCrear: (RecordedRequest r) => altas++,
      respuestaAlta: (RecordedRequest r) {
        if (r.body!['confirmDuplicate'] == true) {
          return jsonData(appointmentJson(clientId: 7, vehicleId: 3), status: 201);
        }
        return jsonError(409, 'APPOINTMENT_DUPLICATE_WARNING', 'Ya hay una cita de este vehículo el mismo día.',
            details: <String, dynamic>{
              'matches': <Map<String, dynamic>>[
                <String, dynamic>{'id': 2, 'scheduledAt': '2030-01-10T09:00'}
              ],
            });
      },
    )));
    await iniciarSesion(tester, api);
    await irANuevaCita(tester);
    await elegirClienteYVehiculo(tester);
    await elegirFechaYHora(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo *'), 'Frenos');

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Cita coincidente'), findsOneWidget);
    expect(find.textContaining('10/01/2030 09:00'), findsOneWidget);

    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(altas, 2);
    expect(find.text('Cita registrada correctamente.'), findsOneWidget);
  });

  testWidgets('test_no_registra_si_el_usuario_cancela_el_aviso_de_cita_coincidente',
      (WidgetTester tester) async {
    int altas = 0;
    final FakeApi api = FakeApi(baseHandler(extra: conCliente(
      alCrear: (RecordedRequest r) => altas++,
      respuestaAlta: (RecordedRequest r) => jsonError(
          409, 'APPOINTMENT_DUPLICATE_WARNING', 'Ya hay una cita.',
          details: <String, dynamic>{'matches': <Map<String, dynamic>>[]}),
    )));
    await iniciarSesion(tester, api);
    await irANuevaCita(tester);
    await elegirClienteYVehiculo(tester);
    await elegirFechaYHora(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo *'), 'Frenos');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(altas, 1);
    expect(find.text('Cita registrada correctamente.'), findsNothing);
  });

  testWidgets('test_pide_confirmacion_al_salir_con_cambios_sin_guardar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await iniciarSesion(tester, api);
    await irANuevaCita(tester);

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo *'), 'Frenos');
    await tester.pump();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Salir sin guardar'), findsOneWidget);
  });
}
