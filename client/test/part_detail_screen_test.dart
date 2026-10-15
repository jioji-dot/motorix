import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirDetalle(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'admin');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Inventario'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Filtro de aceite'));
  await tester.pumpAndSettle();
}

Finder campo(String etiqueta) => find.widgetWithText(TextFormField, etiqueta);

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

/// Estado mutable de la refacción para que las operaciones se reflejen al recargar.
class EstadoInventario {
  int stock = 10;
  final List<Map<String, dynamic>> movimientos = <Map<String, dynamic>>[
    movementJson(id: 2, quantity: -2, type: 'OUT', reason: 'Uso en orden', orderId: 5, orderFolio: 'OS-000005'),
    movementJson(id: 1, quantity: 12, reason: 'Existencia inicial'),
  ];
}

FakeHandler handler(EstadoInventario estado, {http.Response? Function(RecordedRequest)? extra}) => baseHandler(
      role: 'ADMIN',
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/parts' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[
            partJson(id: 1, code: 'FIL-01', name: 'Filtro de aceite', stock: estado.stock, minimumStock: 3),
          ]);
        }
        if (r.path == '/parts/1' && r.method == 'GET') {
          return jsonData(partJson(id: 1, code: 'FIL-01', name: 'Filtro de aceite', stock: estado.stock, minimumStock: 3));
        }
        if (r.path == '/parts/1/movements') return listOf(estado.movimientos);
        return null;
      },
    );

void main() {
  testWidgets('test_el_detalle_muestra_la_existencia_y_los_movimientos_con_signo_y_orden', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(EstadoInventario()));
    await abrirDetalle(tester, api);

    expect(find.text('Detalle de la refacción'), findsOneWidget);
    expect(find.text('FIL-01'), findsOneWidget);
    expect(find.text('Movimientos de inventario'), findsOneWidget);
    expect(find.text('+12'), findsOneWidget);
    expect(find.text('-2'), findsOneWidget);
    expect(find.text('Salida'), findsOneWidget);
    expect(find.text('OS-000005'), findsOneWidget);
    expect(find.text('Registrar entrada'), findsOneWidget);
    expect(find.text('Ajustar existencia'), findsOneWidget);
  });

  testWidgets('test_la_entrada_exige_cantidad_y_motivo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(EstadoInventario()));
    await abrirDetalle(tester, api);

    await tester.tap(find.text('Registrar entrada'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ingresa la cantidad recibida.'), findsOneWidget);
    expect(find.text('Ingresa el motivo.'), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.path.endsWith('/entries')), isFalse);
  });

  testWidgets('test_la_entrada_envia_cantidad_y_motivo_y_recarga_la_existencia', (WidgetTester tester) async {
    final EstadoInventario estado = EstadoInventario();
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) {
        if (r.path == '/parts/1/entries' && r.method == 'POST') {
          estado.stock = 18;
          estado.movimientos.insert(0, movementJson(id: 3, quantity: 8, reason: 'Compra a proveedor'));
          return jsonData(<String, dynamic>{
            'part': partJson(id: 1, stock: 18),
            'movement': movementJson(id: 3, quantity: 8),
          }, status: 201);
        }
        return null;
      },
    ));
    await abrirDetalle(tester, api);

    await tester.tap(find.text('Registrar entrada'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Cantidad recibida *'), '8');
    await tester.enterText(campo('Motivo *'), 'Compra a proveedor');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.path == '/parts/1/entries');
    expect(envio.body, <String, dynamic>{'quantity': 8, 'reason': 'Compra a proveedor'});
    expect(find.text('Entrada registrada correctamente.'), findsOneWidget);
    expect(find.text('18'), findsWidgets);
    expect(find.text('+8'), findsOneWidget);
  });

  testWidgets('test_el_ajuste_muestra_la_diferencia_y_envia_la_existencia_contada', (WidgetTester tester) async {
    final EstadoInventario estado = EstadoInventario();
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) {
        if (r.path == '/parts/1/adjustments' && r.method == 'POST') {
          estado.stock = 7;
          return jsonData(<String, dynamic>{
            'part': partJson(id: 1, stock: 7),
            'movement': movementJson(id: 4, type: 'ADJUSTMENT', quantity: -3),
          }, status: 201);
        }
        return null;
      },
    ));
    await abrirDetalle(tester, api);

    await tester.tap(find.text('Ajustar existencia'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Existencia contada *'), '7');
    await tester.pump();
    expect(find.text('Diferencia: -3'), findsOneWidget);
    await tester.enterText(campo('Motivo *'), 'Conteo físico');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.path == '/parts/1/adjustments');
    expect(envio.body, <String, dynamic>{'newStock': 7, 'reason': 'Conteo físico'});
    expect(find.text('Ajuste registrado correctamente.'), findsOneWidget);
  });

  testWidgets('test_un_error_del_servidor_en_el_ajuste_se_muestra_sin_cerrar_la_pantalla', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      EstadoInventario(),
      extra: (RecordedRequest r) => r.path == '/parts/1/adjustments'
          ? jsonError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', details: <Map<String, String>>[
              <String, String>{'field': 'newStock', 'message': 'La existencia contada es igual a la actual (10).'},
            ])
          : null,
    ));
    await abrirDetalle(tester, api);

    await tester.tap(find.text('Ajustar existencia'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Existencia contada *'), '10');
    await tester.enterText(campo('Motivo *'), 'Conteo');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('La existencia contada es igual a la actual (10).'), findsOneWidget);
    expect(find.text('Detalle de la refacción'), findsOneWidget);
  });

  testWidgets('test_una_refaccion_sin_movimientos_muestra_el_estado_vacio', (WidgetTester tester) async {
    final EstadoInventario estado = EstadoInventario()..movimientos.clear();
    final FakeApi api = FakeApi(handler(estado));
    await abrirDetalle(tester, api);

    expect(find.text('Esta refacción aún no tiene movimientos.'), findsOneWidget);
  });
}
