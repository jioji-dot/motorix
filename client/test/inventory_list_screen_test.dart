import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirComo(WidgetTester tester, FakeApi api, {String usuario = 'admin'}) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

Future<void> irAInventario(WidgetTester tester) async {
  await tester.tap(find.text('Inventario'));
  await tester.pumpAndSettle();
}

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

FakeHandler handler({
  String role = 'ADMIN',
  List<Map<String, dynamic>>? partes,
  http.Response? Function(RecordedRequest)? extra,
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/parts' && r.method == 'GET') {
          return listOf(partes ??
              <Map<String, dynamic>>[
                partJson(id: 1, code: 'FIL-01', name: 'Filtro de aceite', stock: 10, minimumStock: 3),
                partJson(id: 2, code: 'BAL-01', name: 'Balatas delanteras', stock: 2, minimumStock: 4),
                partJson(id: 3, code: 'BUJ-01', name: 'Bujía', stock: 0, minimumStock: 4),
                partJson(id: 4, code: 'OLD-01', name: 'Pieza descontinuada', stock: 5, active: false),
              ]);
        }
        return null;
      },
    );

void main() {
  testWidgets('test_el_administrador_ve_el_inventario_con_los_estados_de_existencia', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirComo(tester, api);
    await irAInventario(tester);

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Normal'), findsOneWidget);
    expect(find.text('Stock bajo'), findsOneWidget);
    expect(find.text('Agotada'), findsOneWidget);
    expect(find.text('Inactiva'), findsOneWidget);
    expect(find.text('Nueva refacción'), findsOneWidget);
  });

  testWidgets('test_la_busqueda_envia_el_texto_al_servidor', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirComo(tester, api);
    await irAInventario(tester);

    await tester.enterText(find.byType(TextField).first, 'balatas');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    final RecordedRequest ultima = api.requests.lastWhere((RecordedRequest r) => r.path == '/parts');
    expect(ultima.query['search'], 'balatas');
  });

  testWidgets('test_el_inventario_vacio_muestra_un_mensaje_con_accion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(partes: <Map<String, dynamic>>[]));
    await abrirComo(tester, api);
    await irAInventario(tester);

    expect(find.text('Aún no hay refacciones registradas.'), findsOneWidget);
    expect(find.text('Nueva refacción'), findsWidgets);
  });

  testWidgets('test_dar_de_baja_pide_confirmacion_y_llama_a_deactivate', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) =>
          r.path == '/parts/1/deactivate' ? jsonData(partJson(id: 1, active: false)) : null,
    ));
    await abrirComo(tester, api);
    await irAInventario(tester);

    await tester.tap(find.byTooltip('Dar de baja').first);
    await tester.pumpAndSettle();
    expect(find.text('Dar de baja la refacción'), findsOneWidget);
    await tester.tap(botonDelDialogo('Dar de baja'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/parts/1/deactivate' && r.method == 'POST'), isTrue);
    expect(find.text('Refacción dada de baja correctamente.'), findsOneWidget);
  });

  testWidgets('test_cancelar_la_baja_no_llama_al_servidor', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirComo(tester, api);
    await irAInventario(tester);

    await tester.tap(find.byTooltip('Dar de baja').first);
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path.endsWith('/deactivate')), isFalse);
  });

  testWidgets('test_reactivar_una_refaccion_inactiva_no_pide_confirmacion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) =>
          r.path == '/parts/4/activate' ? jsonData(partJson(id: 4, active: true)) : null,
    ));
    await abrirComo(tester, api);
    await irAInventario(tester);

    await tester.tap(find.byTooltip('Reactivar'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/parts/4/activate'), isTrue);
    expect(find.text('Refacción reactivada correctamente.'), findsOneWidget);
  });

  testWidgets('test_la_entrada_inventario_solo_aparece_para_el_administrador', (WidgetTester tester) async {
    for (final String rol in <String>['RECEPTIONIST', 'MECHANIC']) {
      final FakeApi api = FakeApi(handler(role: rol));
      await abrirComo(tester, api, usuario: 'otro');

      expect(find.text('Inventario'), findsNothing, reason: 'rol $rol');
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });

  testWidgets('test_un_error_del_servidor_muestra_el_mensaje_y_permite_reintentar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/parts' && r.method == 'GET'
          ? jsonError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
          : null,
    ));
    await abrirComo(tester, api);
    await irAInventario(tester);

    expect(find.text('Ocurrió un error inesperado. Inténtalo de nuevo.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });
}
