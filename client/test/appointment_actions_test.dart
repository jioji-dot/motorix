import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirCitas(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(2600, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Citas'));
  await tester.pumpAndSettle();
}

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

http.Response? Function(RecordedRequest) manejador({
  required List<Map<String, dynamic>> citas,
  void Function(RecordedRequest)? alMutar,
  http.Response Function(RecordedRequest)? respuestaMutacion,
}) {
  return (RecordedRequest r) {
    if (r.path == '/appointments' && r.method == 'GET') return listOf(citas);
    if (r.path == '/clients/1') {
      return jsonData(clientJson(
        id: 1,
        name: 'Ana Pérez',
        vehicles: <Map<String, dynamic>>[vehicleJson(id: 1, clientId: 1)],
      ));
    }
    if (r.path.startsWith('/appointments/') && r.method != 'GET') {
      alMutar?.call(r);
      return respuestaMutacion?.call(r) ?? jsonData(citas.first);
    }
    return null;
  };
}

const List<String> todas = <String>[
  'Crear orden de servicio',
  'Confirmar cita',
  'Modificar cita',
  'Cancelar cita',
  'Ver orden de servicio',
];

void verificarAcciones(List<String> esperadas) {
  for (final String accion in todas) {
    expect(
      find.byTooltip(accion),
      esperadas.contains(accion) ? findsOneWidget : findsNothing,
      reason: 'la acción "$accion" ${esperadas.contains(accion) ? 'debía' : 'no debía'} mostrarse',
    );
  }
}

void main() {
  testWidgets('test_una_cita_pendiente_ofrece_crear_orden_confirmar_modificar_y_cancelar',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(citas: <Map<String, dynamic>>[appointmentJson(status: 'PENDIENTE')]),
    ));
    await abrirCitas(tester, api);

    verificarAcciones(<String>['Crear orden de servicio', 'Confirmar cita', 'Modificar cita', 'Cancelar cita']);
  });

  testWidgets('test_una_cita_confirmada_ya_no_ofrece_confirmar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(citas: <Map<String, dynamic>>[appointmentJson(status: 'CONFIRMADA')]),
    ));
    await abrirCitas(tester, api);

    verificarAcciones(<String>['Crear orden de servicio', 'Modificar cita', 'Cancelar cita']);
  });

  testWidgets('test_una_cita_con_orden_solo_permite_ver_la_orden', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(citas: <Map<String, dynamic>>[appointmentJson(status: 'EN_PROCESO', orderId: 5)]),
    ));
    await abrirCitas(tester, api);

    verificarAcciones(<String>['Ver orden de servicio']);
  });

  testWidgets('test_las_citas_canceladas_y_completadas_no_tienen_acciones', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(citas: <Map<String, dynamic>>[
        appointmentJson(id: 1, status: 'CANCELADA'),
        appointmentJson(id: 2, status: 'COMPLETADA'),
      ]),
    ));
    await abrirCitas(tester, api);

    verificarAcciones(<String>[]);
  });

  testWidgets('test_cancelar_una_cita_pide_confirmacion_y_no_envia_nada_si_se_cancela',
      (WidgetTester tester) async {
    final List<RecordedRequest> llamadas = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(citas: <Map<String, dynamic>>[appointmentJson()], alMutar: llamadas.add),
    ));
    await abrirCitas(tester, api);

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();

    expect(find.text('Cancelar cita'), findsWidgets);
    expect(find.textContaining('¿Seguro que quieres cancelar la cita de Ana Pérez'), findsOneWidget);

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(llamadas, isEmpty);
  });

  testWidgets('test_confirmar_la_cancelacion_envia_la_peticion_y_avisa', (WidgetTester tester) async {
    final List<RecordedRequest> llamadas = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        citas: <Map<String, dynamic>>[appointmentJson(id: 4)],
        alMutar: llamadas.add,
      ),
    ));
    await abrirCitas(tester, api);

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(llamadas.single.method, 'POST');
    expect(llamadas.single.path, '/appointments/4/cancel');
    expect(find.text('Cita cancelada.'), findsOneWidget);
  });

  testWidgets('test_confirmar_una_cita_pendiente_envia_la_peticion', (WidgetTester tester) async {
    final List<RecordedRequest> llamadas = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(citas: <Map<String, dynamic>>[appointmentJson(id: 4)], alMutar: llamadas.add),
    ));
    await abrirCitas(tester, api);

    await tester.tap(find.byTooltip('Confirmar cita'));
    await tester.pumpAndSettle();

    expect(llamadas.single.path, '/appointments/4/confirm');
    expect(find.text('Cita confirmada.'), findsOneWidget);
  });

  testWidgets('test_muestra_el_motivo_del_servidor_si_no_se_puede_cancelar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        citas: <Map<String, dynamic>>[appointmentJson()],
        respuestaMutacion: (RecordedRequest r) => jsonError(
            409, 'APPOINTMENT_HAS_ORDER', 'La cita ya tiene una orden de servicio y no se puede cancelar.'),
      ),
    ));
    await abrirCitas(tester, api);

    await tester.tap(find.byTooltip('Cancelar cita'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(find.text('La cita ya tiene una orden de servicio y no se puede cancelar.'), findsOneWidget);
  });

  testWidgets('test_modificar_abre_el_formulario_con_los_datos_actuales_y_envia_solo_fecha_motivo_y_notas',
      (WidgetTester tester) async {
    final List<RecordedRequest> llamadas = <RecordedRequest>[];
    // La cita debe estar dentro de la ventana válida (futura y a menos de un año).
    final DateTime dia = DateTime.now().add(const Duration(days: 30));
    String dos(int n) => n.toString().padLeft(2, '0');
    final String fecha = '${dia.year}-${dos(dia.month)}-${dos(dia.day)}T10:00';
    final String fechaVista = '${dos(dia.day)}/${dos(dia.month)}/${dia.year} 10:00';
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        citas: <Map<String, dynamic>>[
          appointmentJson(id: 4, scheduledAt: fecha, reason: 'Cambio de aceite', notes: 'Traer llave'),
        ],
        alMutar: llamadas.add,
      ),
    ));
    await abrirCitas(tester, api);

    await tester.tap(find.byTooltip('Modificar cita'));
    await tester.pumpAndSettle();

    expect(find.text('Editar cita'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Cambio de aceite'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Traer llave'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, fechaVista), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Cambio de aceite'), 'Frenos');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(llamadas.single.method, 'PATCH');
    expect(llamadas.single.path, '/appointments/4');
    expect(llamadas.single.body, <String, dynamic>{
      'scheduledAt': fecha,
      'reason': 'Frenos',
      'notes': 'Traer llave',
    });
    expect(find.text('Cita actualizada correctamente.'), findsOneWidget);
  });
}
