import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api, {String role = 'MECHANIC'}) async {
  tester.view.physicalSize = const Size(2400, 1800);
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

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

Map<String, dynamic> orden(String status, List<String> transiciones, {String? mechanicName = 'Mario Mecánico'}) =>
    orderJson(
      id: 5,
      folio: 'OS-000005',
      status: status,
      mechanicId: mechanicName == null ? null : 1,
      mechanicName: mechanicName,
      allowedTransitions: transiciones,
    );

http.Response? Function(RecordedRequest) manejador({
  required Map<String, dynamic> Function() actual,
  void Function(RecordedRequest)? alCambiar,
  http.Response Function(RecordedRequest)? respuestaCambio,
}) {
  return (RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') return jsonData(actual());
    if (r.path == '/orders/5/status' && r.method == 'POST') {
      alCambiar?.call(r);
      return respuestaCambio?.call(r) ?? jsonData(actual());
    }
    return null;
  };
}

void main() {
  testWidgets('test_ofrece_el_boton_de_cada_transicion_permitida_con_textos_claros', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden('EN_REPARACION', <String>['ESPERANDO_REFACCION', 'TERMINADO'])),
    ));
    await abrirOrden(tester, api);

    expect(find.text('Esperando refacción'), findsWidgets);
    expect(find.text('Marcar como terminado'), findsOneWidget);
    expect(find.text('Marcar como entregado'), findsNothing);
    expect(find.text('Pasar a diagnóstico'), findsNothing);
  });

  testWidgets('test_los_textos_dependen_del_estado_de_origen', (WidgetTester tester) async {
    final FakeApi desdeDiagnostico = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden('DIAGNOSTICO', <String>['EN_REPARACION'])),
    ));
    await abrirOrden(tester, desdeDiagnostico);
    expect(find.text('Iniciar reparación'), findsOneWidget);
  });

  testWidgets('test_desde_esperando_refaccion_se_ofrece_reanudar_la_reparacion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden('ESPERANDO_REFACCION', <String>['EN_REPARACION'])),
    ));
    await abrirOrden(tester, api);

    expect(find.text('Reanudar reparación'), findsOneWidget);
  });

  testWidgets('test_sin_transiciones_permitidas_no_hay_botones_de_avance', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden('TERMINADO', <String>[])),
    ));
    await abrirOrden(tester, api);

    for (final String texto in <String>[
      'Pasar a diagnóstico',
      'Iniciar reparación',
      'Marcar como terminado',
      'Marcar como entregado',
    ]) {
      expect(find.text(texto), findsNothing);
    }
  });

  testWidgets('test_avanza_el_estado_enviando_el_nuevo_estado_y_actualiza_la_pantalla', (WidgetTester tester) async {
    RecordedRequest? cambio;
    Map<String, dynamic> estado = orden('RECIBIDO', <String>['DIAGNOSTICO']);
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => estado,
        alCambiar: (RecordedRequest r) {
          cambio = r;
          estado = orden('DIAGNOSTICO', <String>['EN_REPARACION']);
        },
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Pasar a diagnóstico'));
    await tester.pumpAndSettle();

    expect(cambio!.body, <String, dynamic>{'status': 'DIAGNOSTICO'});
    expect(find.text('La orden OS-000005 pasó a diagnóstico.'), findsOneWidget);
    expect(find.text('Iniciar reparación'), findsOneWidget);
    expect(find.text('Pasar a diagnóstico'), findsNothing);
  });

  testWidgets('test_marcar_como_entregado_pide_confirmacion_y_no_envia_nada_si_se_cancela',
      (WidgetTester tester) async {
    final List<RecordedRequest> cambios = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        actual: () => orden('TERMINADO', <String>['ENTREGADO']),
        alCambiar: cambios.add,
      ),
    ));
    await abrirOrden(tester, api, role: 'RECEPTIONIST');

    await tester.tap(find.text('Marcar como entregado'));
    await tester.pumpAndSettle();

    expect(find.text('Marcar como entregada'), findsOneWidget);
    expect(find.textContaining('ya no se podrá modificar'), findsOneWidget);

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();
    expect(cambios, isEmpty);
  });

  testWidgets('test_confirmar_la_entrega_envia_el_cambio_a_entregado', (WidgetTester tester) async {
    final List<RecordedRequest> cambios = <RecordedRequest>[];
    Map<String, dynamic> estado = orden('TERMINADO', <String>['ENTREGADO']);
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        actual: () => estado,
        alCambiar: (RecordedRequest r) {
          cambios.add(r);
          estado = orden('ENTREGADO', <String>[]);
        },
      ),
    ));
    await abrirOrden(tester, api, role: 'RECEPTIONIST');

    await tester.tap(find.text('Marcar como entregado'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(cambios.single.body, <String, dynamic>{'status': 'ENTREGADO'});
    expect(find.text('Marcar como entregado'), findsNothing);
    expect(find.text('Entregado'), findsWidgets);
  });

  testWidgets('test_mostrar_los_motivos_del_servidor_cuando_no_se_puede_avanzar', (WidgetTester tester) async {
    final List<http.Response> respuestas = <http.Response>[
      jsonError(409, 'MECHANIC_REQUIRED', 'Asigna un mecánico a la orden antes de avanzar su estado.'),
      jsonError(409, 'ORDER_INCOMPLETE',
          'Para terminar la orden registra el diagnóstico y al menos un servicio o una línea de mano de obra.',
          details: <String, dynamic>{'missing': <String>['diagnosis']}),
      jsonError(409, 'INVALID_TRANSITION', 'No se puede pasar la orden de DIAGNOSTICO a TERMINADO.',
          details: <String, dynamic>{'from': 'DIAGNOSTICO', 'to': 'TERMINADO', 'allowed': <String>['EN_REPARACION']}),
    ];
    int llamada = 0;
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => orden('EN_REPARACION', <String>['TERMINADO']),
        respuestaCambio: (RecordedRequest r) => respuestas[llamada++],
      ),
    ));
    await abrirOrden(tester, api);

    for (final String mensaje in <String>[
      'Asigna un mecánico a la orden antes de avanzar su estado.',
      'Para terminar la orden registra el diagnóstico y al menos un servicio o una línea de mano de obra.',
      'No se puede pasar la orden de DIAGNOSTICO a TERMINADO.',
    ]) {
      await tester.tap(find.text('Marcar como terminado'));
      await tester.pumpAndSettle();
      expect(find.text(mensaje), findsOneWidget);
    }
  });
}
