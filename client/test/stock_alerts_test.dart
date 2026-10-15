import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> iniciarSesion(WidgetTester tester, FakeApi api, {String usuario = 'admin'}) async {
  tester.view.physicalSize = const Size(1600, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

Finder campo(String etiqueta) => find.widgetWithText(TextFormField, etiqueta);

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

/// Estado del inventario falso: las alertas se calculan de las refacciones vigentes.
class InventarioFalso {
  InventarioFalso(this.partes);

  List<Map<String, dynamic>> partes;

  int get low => partes.where((Map<String, dynamic> p) => p['active'] == true && p['stockStatus'] == 'LOW').length;
  int get out => partes.where((Map<String, dynamic> p) => p['active'] == true && p['stockStatus'] == 'OUT').length;
}

FakeHandler handler(
  InventarioFalso inv, {
  String role = 'ADMIN',
  http.Response? Function(RecordedRequest)? extra,
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/parts/alerts') {
          return jsonData(<String, dynamic>{'low': inv.low, 'out': inv.out, 'total': inv.low + inv.out});
        }
        if (r.path == '/parts' && r.method == 'GET') {
          final String? alerta = r.query['alert'];
          final List<Map<String, dynamic>> visibles = inv.partes.where((Map<String, dynamic> p) {
            if (alerta == null) return true;
            if (p['active'] != true) return false;
            return alerta == 'ANY' ||
                (alerta == 'LOW' && p['stockStatus'] == 'LOW') ||
                (alerta == 'OUT' && p['stockStatus'] == 'OUT');
          }).where((Map<String, dynamic> p) => alerta == null || p['stockStatus'] != 'OK').toList();
          return listOf(visibles);
        }
        return null;
      },
    );

List<Map<String, dynamic>> muestra() => <Map<String, dynamic>>[
      partJson(id: 1, code: 'FIL-01', name: 'Filtro de aceite', stock: 20, minimumStock: 3),
      partJson(id: 2, code: 'BAL-01', name: 'Balatas', stock: 2, minimumStock: 4),
      partJson(id: 3, code: 'BUJ-01', name: 'Bujía', stock: 0, minimumStock: 4),
    ];

void main() {
  testWidgets('test_la_insignia_del_menu_muestra_el_conteo_de_alertas', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(InventarioFalso(muestra())));
    await iniciarSesion(tester, api);

    expect(find.byType(Badge), findsOneWidget);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('2')), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.path == '/parts/alerts'), isTrue);
  });

  testWidgets('test_sin_alertas_la_insignia_no_se_muestra', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(InventarioFalso(<Map<String, dynamic>>[
      partJson(id: 1, stock: 20, minimumStock: 3),
    ])));
    await iniciarSesion(tester, api);

    final Badge insignia = tester.widget<Badge>(find.byType(Badge));
    expect(insignia.isLabelVisible, isFalse);
  });

  testWidgets('test_un_error_al_consultar_las_alertas_no_rompe_la_aplicacion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      InventarioFalso(muestra()),
      extra: (RecordedRequest r) => r.path == '/parts/alerts'
          ? jsonError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
          : null,
    ));
    await iniciarSesion(tester, api);

    expect(find.text('Inventario'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('test_los_roles_sin_inventario_no_consultan_las_alertas', (WidgetTester tester) async {
    for (final String rol in <String>['RECEPTIONIST', 'MECHANIC']) {
      final FakeApi api = FakeApi(handler(InventarioFalso(muestra()), role: rol));
      await iniciarSesion(tester, api, usuario: 'otro');

      expect(find.byType(Badge), findsNothing, reason: 'rol $rol');
      expect(api.requests.any((RecordedRequest r) => r.path == '/parts/alerts'), isFalse, reason: 'rol $rol');
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });

  testWidgets('test_el_inventario_muestra_el_aviso_con_el_desglose_y_acceso_al_filtro', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(InventarioFalso(muestra())));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Inventario'));
    await tester.pumpAndSettle();

    expect(find.textContaining('2 refacciones por reabastecer'), findsOneWidget);
    expect(find.textContaining('1 con stock bajo y 1 agotada'), findsOneWidget);
    expect(find.text('Ver alertas'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);

    await tester.tap(find.text('Ver alertas'));
    await tester.pumpAndSettle();

    expect(api.requests.lastWhere((RecordedRequest r) => r.path == '/parts').query['alert'], 'ANY');
    expect(find.text('Filtro de aceite'), findsNothing);
    expect(find.text('Balatas'), findsOneWidget);
    expect(find.text('Bujía'), findsOneWidget);
    expect(find.text('Ver alertas'), findsNothing, reason: 'el aviso se oculta al filtrar por alertas');
  });

  testWidgets('test_el_filtro_de_existencia_envia_low_u_out', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(InventarioFalso(muestra())));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Inventario'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Todas').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Agotadas').last);
    await tester.pumpAndSettle();

    expect(api.requests.lastWhere((RecordedRequest r) => r.path == '/parts').query['alert'], 'OUT');
    expect(find.text('Bujía'), findsOneWidget);
    expect(find.text('Balatas'), findsNothing);
  });

  testWidgets('test_sin_alertas_no_hay_aviso_en_el_inventario', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(InventarioFalso(<Map<String, dynamic>>[
      partJson(id: 1, stock: 20, minimumStock: 3),
    ])));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Inventario'));
    await tester.pumpAndSettle();

    expect(find.textContaining('por reabastecer'), findsNothing);
    expect(find.text('Ver alertas'), findsNothing);
  });

  testWidgets('test_con_el_filtro_de_alertas_sin_resultados_explica_que_no_hay', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(InventarioFalso(<Map<String, dynamic>>[
      partJson(id: 1, stock: 20, minimumStock: 3),
    ])));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Inventario'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Todas').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Stock bajo').last);
    await tester.pumpAndSettle();

    expect(find.text('No hay refacciones con esa alerta de existencia.'), findsOneWidget);
  });

  testWidgets('test_una_entrada_de_inventario_actualiza_la_insignia_y_quita_el_aviso', (WidgetTester tester) async {
    final InventarioFalso inv = InventarioFalso(<Map<String, dynamic>>[
      partJson(id: 2, code: 'BAL-01', name: 'Balatas', stock: 2, minimumStock: 4),
    ]);
    final FakeApi api = FakeApi(handler(
      inv,
      extra: (RecordedRequest r) {
        if (r.path == '/parts/2' && r.method == 'GET') {
          return jsonData(inv.partes.first);
        }
        if (r.path == '/parts/2/movements') return listOf(<Map<String, dynamic>>[]);
        if (r.path == '/parts/2/entries' && r.method == 'POST') {
          inv.partes = <Map<String, dynamic>>[partJson(id: 2, code: 'BAL-01', name: 'Balatas', stock: 12, minimumStock: 4)];
          return jsonData(<String, dynamic>{
            'part': inv.partes.first,
            'movement': movementJson(id: 5, partId: 2, quantity: 10),
          }, status: 201);
        }
        return null;
      },
    ));
    await iniciarSesion(tester, api);
    expect(find.descendant(of: find.byType(Badge), matching: find.text('1')), findsOneWidget);

    await tester.tap(find.text('Inventario'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Balatas'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Registrar entrada'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Cantidad recibida *'), '10');
    await tester.enterText(campo('Motivo *'), 'Compra');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final Badge insignia = tester.widget<Badge>(find.byType(Badge));
    expect(insignia.isLabelVisible, isFalse, reason: 'la alerta debía desaparecer tras la entrada');
  });
}
