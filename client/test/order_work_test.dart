import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(2400, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

Finder enDialogo(Finder f) => find.descendant(of: find.byType(AlertDialog), matching: f);
Finder botonDelDialogo(String texto) => enDialogo(find.text(texto));
Finder campoDelDialogo(String etiqueta) => enDialogo(find.widgetWithText(TextFormField, etiqueta));

Map<String, dynamic> orden({
  String status = 'EN_REPARACION',
  bool trabajo = true,
  bool notas = true,
  String? diagnostico,
  List<Map<String, dynamic>> servicios = const <Map<String, dynamic>>[],
  List<Map<String, dynamic>> mano = const <Map<String, dynamic>>[],
}) =>
    orderJson(
      id: 5,
      folio: 'OS-000005',
      status: status,
      mechanicId: 1,
      mechanicName: 'Persona de prueba',
      diagnosis: diagnostico,
      services: servicios,
      labor: mano,
      servicesSubtotal: servicios.fold<double>(0, (double s, Map<String, dynamic> e) => s + (e['amount'] as num)),
      laborSubtotal: mano.fold<double>(0, (double s, Map<String, dynamic> e) => s + (e['amount'] as num)),
      total: servicios.fold<double>(0, (double s, Map<String, dynamic> e) => s + (e['amount'] as num)) +
          mano.fold<double>(0, (double s, Map<String, dynamic> e) => s + (e['amount'] as num)),
      editableWork: trabajo,
      editableNotes: notas,
    );

http.Response? Function(RecordedRequest) manejador({
  required Map<String, dynamic> Function() actual,
  void Function(RecordedRequest)? alMutar,
  http.Response Function(RecordedRequest)? respuestaMutacion,
}) {
  return (RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') return jsonData(actual());
    if (r.path.startsWith('/orders/5/') && r.method != 'GET') {
      alMutar?.call(r);
      return respuestaMutacion?.call(r) ?? jsonData(actual());
    }
    return null;
  };
}

void main() {
  testWidgets('test_en_una_orden_terminada_el_trabajo_es_de_solo_lectura_pero_las_notas_se_editan',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden(status: 'TERMINADO', trabajo: false, notas: true)),
    ));
    await abrirOrden(tester, api);

    expect(find.text('Agregar servicio'), findsNothing);
    expect(find.text('Agregar mano de obra'), findsNothing);
    expect(find.text('Editar diagnóstico'), findsNothing);
    expect(find.text('Editar observaciones'), findsOneWidget);
    expect(find.text('Editar recomendaciones'), findsOneWidget);
  });

  testWidgets('test_en_una_orden_entregada_nada_se_puede_editar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden(status: 'ENTREGADO', trabajo: false, notas: false)),
    ));
    await abrirOrden(tester, api);

    expect(find.textContaining('Editar '), findsNothing);
    expect(find.text('Agregar servicio'), findsNothing);
  });

  testWidgets('test_con_permiso_de_trabajo_muestra_las_acciones_de_edicion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(actual: () => orden()),
    ));
    await abrirOrden(tester, api);

    expect(find.text('Editar diagnóstico'), findsOneWidget);
    expect(find.text('Agregar servicio'), findsOneWidget);
    expect(find.text('Agregar mano de obra'), findsOneWidget);
  });

  testWidgets('test_registra_el_diagnostico_enviandolo_al_servidor', (WidgetTester tester) async {
    RecordedRequest? parche;
    Map<String, dynamic> estado = orden();
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => estado,
        alMutar: (RecordedRequest r) {
          parche = r;
          estado = orden(diagnostico: r.body!['diagnosis'] as String);
        },
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Editar diagnóstico'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Diagnóstico'), 'Balatas gastadas');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(parche!.method, 'PATCH');
    expect(parche!.path, '/orders/5/work');
    expect(parche!.body, <String, dynamic>{'diagnosis': 'Balatas gastadas'});
    expect(find.text('Balatas gastadas'), findsOneWidget);
  });

  testWidgets('test_agrega_un_servicio_validando_el_importe_y_actualiza_los_totales', (WidgetTester tester) async {
    RecordedRequest? alta;
    Map<String, dynamic> estado = orden();
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => estado,
        alMutar: (RecordedRequest r) {
          alta = r;
          estado = orden(servicios: <Map<String, dynamic>>[
            <String, dynamic>{'id': 1, 'description': 'Cambio de balatas', 'amount': 850.5},
          ]);
        },
        respuestaMutacion: (RecordedRequest r) => jsonData(estado, status: 201),
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Cambio de balatas');
    await tester.enterText(campoDelDialogo('Importe *'), '-5');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Usa un número mayor o igual a 0 con máximo dos decimales.'), findsOneWidget);
    expect(alta, isNull, reason: 'no debía enviar un importe inválido');

    await tester.enterText(campoDelDialogo('Importe *'), '850.50');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(alta!.method, 'POST');
    expect(alta!.path, '/orders/5/services');
    expect(alta!.body, <String, dynamic>{'description': 'Cambio de balatas', 'amount': 850.5});
    expect(find.text('Cambio de balatas'), findsOneWidget);
    expect(find.text(r'$850.50'), findsWidgets);
    expect(find.text('Servicio agregado.'), findsOneWidget);
  });

  testWidgets('test_agrega_mano_de_obra_con_vista_previa_del_importe', (WidgetTester tester) async {
    RecordedRequest? alta;
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => orden(),
        alMutar: (RecordedRequest r) => alta = r,
        respuestaMutacion: (RecordedRequest r) => jsonData(orden(), status: 201),
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar mano de obra'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Montaje');
    await tester.enterText(campoDelDialogo('Horas *'), '0');
    await tester.enterText(campoDelDialogo('Tarifa por hora *'), '150');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Las horas deben ser mayores a 0'), findsOneWidget);
    expect(alta, isNull);

    await tester.enterText(campoDelDialogo('Horas *'), '2.5');
    await tester.pump();
    expect(find.text(r'Importe: $375.00'), findsOneWidget);

    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(alta!.path, '/orders/5/labor');
    expect(alta!.body, <String, dynamic>{'description': 'Montaje', 'hours': 2.5, 'hourlyRate': 150.0});
  });

  testWidgets('test_quitar_un_servicio_pide_confirmacion', (WidgetTester tester) async {
    final List<RecordedRequest> bajas = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => orden(servicios: <Map<String, dynamic>>[
          <String, dynamic>{'id': 7, 'description': 'Cambio de aceite', 'amount': 400},
        ]),
        alMutar: bajas.add,
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.byTooltip('Quitar'));
    await tester.pumpAndSettle();

    expect(find.text('Quitar servicio'), findsOneWidget);
    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();
    expect(bajas, isEmpty, reason: 'sin confirmar no debía llamar al servidor');

    await tester.tap(find.byTooltip('Quitar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(bajas.single.method, 'DELETE');
    expect(bajas.single.path, '/orders/5/services/7');
  });

  testWidgets('test_edita_una_linea_de_servicio_con_sus_datos_actuales', (WidgetTester tester) async {
    RecordedRequest? parche;
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => orden(servicios: <Map<String, dynamic>>[
          <String, dynamic>{'id': 7, 'description': 'Cambio de aceite', 'amount': 400},
        ]),
        alMutar: (RecordedRequest r) => parche = r,
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.byTooltip('Editar').first);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextFormField, 'Cambio de aceite'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '400.00'), findsOneWidget);
    await tester.enterText(campoDelDialogo('Importe *'), '450');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(parche!.path, '/orders/5/services/7');
    expect(parche!.body, <String, dynamic>{'description': 'Cambio de aceite', 'amount': 450.0});
  });

  testWidgets('test_muestra_el_error_del_servidor_si_la_orden_ya_no_es_editable', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => orden(),
        respuestaMutacion: (RecordedRequest r) => jsonError(
          409,
          'ORDER_NOT_EDITABLE',
          'La orden en estado TERMINADO no admite este cambio.',
          details: <String, dynamic>{'status': 'TERMINADO'},
        ),
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Extra');
    await tester.enterText(campoDelDialogo('Importe *'), '10');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('La orden en estado TERMINADO no admite este cambio.'), findsOneWidget);
  });

  testWidgets('test_edita_observaciones_y_recomendaciones_de_una_orden_terminada', (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      role: 'MECHANIC',
      extra: manejador(
        actual: () => orden(status: 'TERMINADO', trabajo: false, notas: true),
        alMutar: parches.add,
      ),
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Editar observaciones'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Observaciones'), 'Discos con desgaste leve');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Editar recomendaciones'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Recomendaciones'), 'Revisar en 5,000 km');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(parches[0].body, <String, dynamic>{'notes': 'Discos con desgaste leve'});
    expect(parches[1].body, <String, dynamic>{'recommendations': 'Revisar en 5,000 km'});
  });
}
