import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api, {String usuario = 'mecanico'}) async {
  tester.view.physicalSize = const Size(2400, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (usuario == 'recepcion') {
    await tester.tap(find.text('Órdenes'));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

Finder enDialogo(Finder f) => find.descendant(of: find.byType(AlertDialog), matching: f);
Finder botonDelDialogo(String texto) => enDialogo(find.text(texto));
Finder campoDelDialogo(String etiqueta) => enDialogo(find.widgetWithText(TextFormField, etiqueta));

/// Orden en reparación cuyas refacciones se pueden cambiar en memoria.
class EstadoOrden {
  EstadoOrden({this.status = 'EN_REPARACION', this.editable = true});

  String status;
  bool editable;
  final List<Map<String, dynamic>> partes = <Map<String, dynamic>>[];

  Map<String, dynamic> json() {
    final double subtotal =
        partes.fold<double>(0, (double s, Map<String, dynamic> e) => s + (e['amount'] as num));
    return orderJson(
      id: 5,
      folio: 'OS-000005',
      status: status,
      mechanicId: 1,
      mechanicName: 'Persona de prueba',
      parts: List<Map<String, dynamic>>.of(partes),
      partsSubtotal: subtotal,
      total: subtotal,
      editableWork: editable,
      editableNotes: editable,
      editableParts: editable,
    );
  }
}

FakeHandler handler(
  EstadoOrden estado, {
  String role = 'MECHANIC',
  http.Response? Function(RecordedRequest)? extra,
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/orders' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
        }
        if (r.path == '/orders/5' && r.method == 'GET') return jsonData(estado.json());
        if (r.path == '/parts/available') {
          return jsonData(<Map<String, dynamic>>[
            <String, dynamic>{'id': 1, 'code': 'FIL-01', 'name': 'Filtro de aceite', 'price': 120, 'stock': 4},
            <String, dynamic>{'id': 2, 'code': 'FIL-02', 'name': 'Filtro de aire', 'price': 90, 'stock': 10},
          ]);
        }
        return null;
      },
    );

Future<void> buscarYElegir(WidgetTester tester, String texto, String refaccion) async {
  await tester.enterText(enDialogo(find.byType(TextField)).first, texto);
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pumpAndSettle();
  await tester.tap(find.textContaining(refaccion));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_muestra_la_tabla_de_refacciones_con_el_subtotal_en_el_total', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden()..partes.add(orderPartJson(id: 1, quantity: 2, unitPrice: 120));
    final FakeApi api = FakeApi(handler(estado));
    await abrirOrden(tester, api);

    expect(find.text('Refacciones'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Subtotal de refacciones'), findsOneWidget);
    expect(find.text('\$240.00'), findsWidgets);
    expect(find.text('Agregar refacción'), findsOneWidget);
  });

  testWidgets('test_agregar_busca_elige_y_envia_la_refaccion_y_la_cantidad', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden();
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) {
        if (r.path == '/orders/5/parts' && r.method == 'POST') {
          estado.partes.add(orderPartJson(id: 7, partId: 1, quantity: 3));
          return jsonData(estado.json());
        }
        return null;
      },
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    await buscarYElegir(tester, 'filtro', 'FIL-01');
    await tester.enterText(campoDelDialogo('Cantidad *'), '3');
    await tester.tap(botonDelDialogo('Agregar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.path == '/orders/5/parts');
    expect(envio.body, <String, dynamic>{'partId': 1, 'quantity': 3});
    expect(find.text('Refacción agregada.'), findsOneWidget);
    expect(find.text('\$360.00'), findsWidgets);
  });

  testWidgets('test_agregar_exige_elegir_una_refaccion_y_no_permite_superar_la_existencia', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden();
    final FakeApi api = FakeApi(handler(estado));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Agregar'));
    await tester.pumpAndSettle();
    expect(find.text('Elige una refacción de la lista.'), findsOneWidget);

    await buscarYElegir(tester, 'filtro', 'FIL-01');
    await tester.enterText(campoDelDialogo('Cantidad *'), '9');
    await tester.tap(botonDelDialogo('Agregar'));
    await tester.pumpAndSettle();

    expect(find.text('Solo hay 4 en existencia.'), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.path == '/orders/5/parts'), isFalse);
  });

  testWidgets('test_rechaza_cantidades_cero_negativas_o_decimales', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden();
    final FakeApi api = FakeApi(handler(estado));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    await buscarYElegir(tester, 'filtro', 'FIL-01');
    for (final String valor in <String>['0', '-1', '1.5', '']) {
      await tester.enterText(campoDelDialogo('Cantidad *'), valor);
      await tester.tap(botonDelDialogo('Agregar'));
      await tester.pumpAndSettle();
      expect(
        find.textContaining(valor.isEmpty ? 'Ingresa la cantidad.' : 'Usa un número entero mayor o igual a 1.'),
        findsOneWidget,
        reason: 'cantidad "$valor"',
      );
    }
    expect(api.requests.any((RecordedRequest r) => r.path == '/orders/5/parts'), isFalse);
  });

  testWidgets('test_el_error_de_existencia_insuficiente_del_servidor_se_muestra', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden();
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) => r.path == '/orders/5/parts' && r.method == 'POST'
          ? jsonError(409, 'INSUFFICIENT_STOCK', 'No hay existencia suficiente: disponible 1, solicitado 2.',
              details: <String, dynamic>{'partId': 1, 'available': 1, 'requested': 2})
          : null,
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    await buscarYElegir(tester, 'filtro', 'FIL-01');
    await tester.enterText(campoDelDialogo('Cantidad *'), '2');
    await tester.tap(botonDelDialogo('Agregar'));
    await tester.pumpAndSettle();

    expect(find.text('No hay existencia suficiente: disponible 1, solicitado 2.'), findsOneWidget);
  });

  testWidgets('test_cambiar_la_cantidad_envia_el_nuevo_valor', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden()..partes.add(orderPartJson(id: 7, quantity: 2));
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) {
        if (r.path == '/orders/5/parts/7' && r.method == 'PATCH') {
          estado.partes[0] = orderPartJson(id: 7, quantity: 5);
          return jsonData(estado.json());
        }
        return null;
      },
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.byTooltip('Cambiar cantidad'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Cantidad *'), '5');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(envio.body, <String, dynamic>{'quantity': 5});
    expect(find.text('Cantidad actualizada.'), findsOneWidget);
  });

  testWidgets('test_quitar_pide_confirmacion_y_cancelar_no_llama_al_servidor', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden()..partes.add(orderPartJson(id: 7, quantity: 2));
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) {
        if (r.path == '/orders/5/parts/7' && r.method == 'DELETE') {
          estado.partes.clear();
          return jsonData(estado.json());
        }
        return null;
      },
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.byTooltip('Quitar refacción'));
    await tester.pumpAndSettle();
    expect(find.text('Quitar refacción'), findsWidgets);
    expect(find.textContaining('regresarán al inventario'), findsOneWidget);
    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();
    expect(api.requests.any((RecordedRequest r) => r.method == 'DELETE'), isFalse);

    await tester.tap(find.byTooltip('Quitar refacción'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Quitar'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.method == 'DELETE' && r.path == '/orders/5/parts/7'), isTrue);
    expect(find.text('Refacción quitada.'), findsOneWidget);
    expect(find.text('Aún no hay refacciones registradas.'), findsOneWidget);
  });

  testWidgets('test_recepcion_ve_las_refacciones_en_solo_lectura', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden(editable: false)..partes.add(orderPartJson(id: 7, quantity: 2));
    final FakeApi api = FakeApi(handler(estado, role: 'RECEPTIONIST'));
    await abrirOrden(tester, api, usuario: 'recepcion');

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Agregar refacción'), findsNothing);
    expect(find.byTooltip('Cambiar cantidad'), findsNothing);
    expect(find.byTooltip('Quitar refacción'), findsNothing);
  });

  testWidgets('test_una_orden_terminada_no_ofrece_cambios_de_refacciones', (WidgetTester tester) async {
    final EstadoOrden estado = EstadoOrden(status: 'TERMINADO', editable: false)
      ..partes.add(orderPartJson(id: 7, quantity: 1));
    final FakeApi api = FakeApi(handler(estado));
    await abrirOrden(tester, api);

    expect(find.text('Agregar refacción'), findsNothing);
    expect(find.byTooltip('Quitar refacción'), findsNothing);
  });
}
