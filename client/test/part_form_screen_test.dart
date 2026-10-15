import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirInventario(WidgetTester tester, FakeApi api) async {
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
}

Finder campo(String etiqueta) => find.widgetWithText(TextFormField, etiqueta);

FakeHandler handler({http.Response? Function(RecordedRequest)? extra}) => baseHandler(
      role: 'ADMIN',
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/parts' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[
            partJson(id: 1, code: 'FIL-01', name: 'Filtro de aceite', stock: 10, price: 120),
          ]);
        }
        return null;
      },
    );

void main() {
  testWidgets('test_el_alta_valida_los_campos_obligatorios', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirInventario(tester, api);

    await tester.tap(find.text('Nueva refacción'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('El código es obligatorio.'), findsOneWidget);
    expect(find.text('Ingresa el nombre.'), findsOneWidget);
    expect(find.text('Ingresa el precio.'), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.method == 'POST' && r.path == '/parts'), isFalse);
  });

  testWidgets('test_el_alta_envia_los_datos_y_regresa_al_listado', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/parts' && r.method == 'POST'
          ? jsonData(partJson(id: 9, code: 'BAL-02', name: 'Balatas traseras', stock: 6), status: 201)
          : null,
    ));
    await abrirInventario(tester, api);

    await tester.tap(find.text('Nueva refacción'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Código *'), 'BAL-02');
    await tester.enterText(campo('Nombre *'), 'Balatas traseras');
    await tester.enterText(campo('Precio *'), '450.50');
    await tester.enterText(campo('Stock mínimo *'), '4');
    await tester.enterText(campo('Existencia inicial'), '6');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio =
        api.requests.lastWhere((RecordedRequest r) => r.method == 'POST' && r.path == '/parts');
    expect(envio.body, <String, dynamic>{
      'code': 'BAL-02',
      'name': 'Balatas traseras',
      'description': null,
      'price': 450.5,
      'minimumStock': 4,
      'initialStock': 6,
    });
    expect(find.text('Refacción registrada correctamente.'), findsOneWidget);
    expect(find.text('Inventario'), findsWidgets);
  });

  testWidgets('test_un_codigo_duplicado_se_muestra_en_el_campo_del_codigo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/parts' && r.method == 'POST'
          ? jsonError(409, 'PART_CODE_DUPLICATE', 'Ya existe una refacción con ese código.',
              details: <String, dynamic>{'field': 'code'})
          : null,
    ));
    await abrirInventario(tester, api);

    await tester.tap(find.text('Nueva refacción'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Código *'), 'FIL-01');
    await tester.enterText(campo('Nombre *'), 'Otro filtro');
    await tester.enterText(campo('Precio *'), '99');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ya existe una refacción con ese código.'), findsOneWidget);
  });

  testWidgets('test_los_valores_negativos_o_decimales_en_existencias_se_rechazan', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirInventario(tester, api);

    await tester.tap(find.text('Nueva refacción'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Código *'), 'X-1');
    await tester.enterText(campo('Nombre *'), 'Pieza');
    await tester.enterText(campo('Precio *'), '10');
    await tester.enterText(campo('Stock mínimo *'), '-2');
    await tester.enterText(campo('Existencia inicial'), '1.5');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Usa un número entero mayor o igual a 0.'), findsNWidgets(2));
  });

  testWidgets('test_la_edicion_no_ofrece_existencia_inicial_y_envia_el_cambio', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/parts/1' && r.method == 'PATCH'
          ? jsonData(partJson(id: 1, name: 'Filtro premium'))
          : null,
    ));
    await abrirInventario(tester, api);

    await tester.tap(find.byTooltip('Editar refacción').first);
    await tester.pumpAndSettle();
    expect(find.text('Editar refacción'), findsWidgets);
    expect(campo('Existencia inicial'), findsNothing);
    expect(find.textContaining('solo cambia con entradas y ajustes'), findsOneWidget);

    await tester.enterText(campo('Nombre *'), 'Filtro premium');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio =
        api.requests.lastWhere((RecordedRequest r) => r.method == 'PATCH' && r.path == '/parts/1');
    expect(envio.body!['name'], 'Filtro premium');
    expect(envio.body!.containsKey('stock'), isFalse);
    expect(envio.body!.containsKey('initialStock'), isFalse);
    expect(find.text('Refacción actualizada correctamente.'), findsOneWidget);
  });

  testWidgets('test_salir_con_cambios_sin_guardar_pide_confirmacion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirInventario(tester, api);

    await tester.tap(find.text('Nueva refacción'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Código *'), 'ABC');
    await tester.pump(); // reconstruye el formulario para que PopScope vea el cambio
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Salir sin guardar'), findsOneWidget);
  });
}
