import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirPanel(WidgetTester tester, FakeApi api, {Size tamano = const Size(1600, 2400)}) async {
  tester.view.physicalSize = tamano;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'admin');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

FakeApi apiCon(http.Response Function(RecordedRequest) panel) => FakeApi(baseHandler(
      role: 'ADMIN',
      extra: (RecordedRequest r) => r.path == '/dashboard' ? panel(r) : null,
    ));

void main() {
  testWidgets('test_el_administrador_inicia_en_el_panel_con_todas_las_secciones', (WidgetTester tester) async {
    final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson()));
    await abrirPanel(tester, api);

    expect(find.text('Panel de control'), findsOneWidget);
    for (final String seccion in <String>['Órdenes', 'Citas', 'Mantenimientos', 'Inventario', 'Pagos']) {
      expect(find.text(seccion), findsWidgets, reason: 'falta la sección $seccion');
    }
    expect(find.text('Terminadas sin entregar'), findsOneWidget);
    expect(find.text('Entregadas hoy'), findsOneWidget);
    expect(find.text('Citas de hoy'), findsOneWidget);
    expect(find.text('Siguiente cita'), findsOneWidget);
    expect(find.textContaining('Ana Pérez · PRD482A'), findsOneWidget);
    expect(find.text('Vencidos'), findsOneWidget);
    expect(find.text('En 30 días o 1,000 km'), findsOneWidget);
    expect(find.text('Stock bajo'), findsWidgets, reason: 'tarjeta y chip de la lista crítica');
    expect(find.text('Agotadas'), findsOneWidget);
    expect(find.text('Disco de freno delantero (DIS-DEL)'), findsOneWidget);
    expect(find.text('Cobrado hoy'), findsOneWidget);
    expect(find.text('\$2,300.00'), findsOneWidget);
    expect(find.text('\$4,150.00'), findsOneWidget);
    expect(find.textContaining('Actualizado:'), findsOneWidget);
  });

  testWidgets('test_sin_datos_muestra_ceros_y_mensajes_vacios', (WidgetTester tester) async {
    final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson(
          orders: <String, dynamic>{
            'received': 0,
            'diagnosis': 0,
            'inRepair': 0,
            'waitingPart': 0,
            'finishedNotDelivered': 0,
            'deliveredToday': 0,
          },
          appointments: <String, dynamic>{'today': 0, 'next7Days': 0, 'next': null},
          maintenance: <String, dynamic>{'overdue': 0, 'upcoming': 0, 'warningDays': 30, 'warningKm': 1000},
          inventory: <String, dynamic>{'low': 0, 'out': 0, 'critical': <dynamic>[]},
          payments: <String, dynamic>{'collectedToday': 0.0, 'pendingBalance': 0.0, 'ordersToCollect': 0},
        )));
    await abrirPanel(tester, api);

    expect(find.text('No hay citas próximas.'), findsOneWidget);
    expect(find.text('No hay refacciones con stock bajo o agotadas.'), findsOneWidget);
    expect(find.text('\$0.00'), findsNWidgets(2));
  });

  testWidgets('test_un_error_al_cargar_muestra_el_mensaje_con_reintento', (WidgetTester tester) async {
    bool fallar = true;
    final FakeApi api = apiCon((RecordedRequest r) =>
        fallar ? jsonError(500, 'INTERNAL_ERROR', 'No se pudo cargar el panel.') : jsonData(dashboardJson()));
    await abrirPanel(tester, api);

    expect(find.text('No se pudo cargar el panel.'), findsOneWidget);

    fallar = false;
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();

    expect(find.text('Citas de hoy'), findsOneWidget);
  });

  testWidgets('test_actualizar_vuelve_a_pedir_los_datos_y_cambia_la_hora', (WidgetTester tester) async {
    int llamadas = 0;
    final FakeApi api = apiCon((RecordedRequest r) {
      llamadas++;
      return jsonData(dashboardJson(
        generatedAt: llamadas == 1 ? '2026-10-14T17:00:00.000Z' : '2026-10-14T18:30:00.000Z',
        payments: <String, dynamic>{
          'collectedToday': llamadas == 1 ? 100.0 : 900.0,
          'pendingBalance': 0.0,
          'ordersToCollect': 0,
        },
      ));
    });
    await abrirPanel(tester, api);
    final String horaAntes = tester.widget<Text>(find.textContaining('Actualizado:')).data!;
    expect(find.text('\$100.00'), findsOneWidget);

    await tester.tap(find.text('Actualizar'));
    await tester.pumpAndSettle();

    expect(llamadas, 2);
    expect(tester.widget<Text>(find.textContaining('Actualizado:')).data, isNot(horaAntes));
    expect(find.text('\$900.00'), findsOneWidget);
  });

  testWidgets('test_si_falla_al_actualizar_conserva_los_ultimos_datos_y_avisa', (WidgetTester tester) async {
    int llamadas = 0;
    final FakeApi api = apiCon((RecordedRequest r) {
      llamadas++;
      return llamadas == 1 ? jsonData(dashboardJson()) : jsonError(503, 'UNAVAILABLE', 'Servicio no disponible.');
    });
    await abrirPanel(tester, api);

    await tester.tap(find.text('Actualizar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Servicio no disponible.'), findsOneWidget);
    expect(find.text('Citas de hoy'), findsOneWidget, reason: 'se conservan los últimos datos');
  });

  testWidgets('test_cada_indicador_abre_su_modulo', (WidgetTester tester) async {
    final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson()));
    await abrirPanel(tester, api);

    await tester.tap(find.text('Citas de hoy'));
    await tester.pumpAndSettle();
    expect(api.requests.any((RecordedRequest r) => r.path == '/appointments'), isTrue);
    expect(find.text('Panel de control'), findsNothing);
  });

  for (final (String, String) caso in <(String, String)>[
    ('Recibidas', '/orders'),
    ('Vencidos', '/maintenance'),
  ]) {
    testWidgets('test_el_indicador_${caso.$1.toLowerCase()}_abre_su_modulo', (WidgetTester tester) async {
      final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson()));
      await abrirPanel(tester, api);

      await tester.tap(find.text(caso.$1));
      await tester.pumpAndSettle();

      expect(api.requests.any((RecordedRequest r) => r.path == caso.$2), isTrue);
    });
  }

  testWidgets('test_el_indicador_de_agotadas_abre_el_inventario_filtrado', (WidgetTester tester) async {
    final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson()));
    await abrirPanel(tester, api);

    await tester.tap(find.text('Agotadas'));
    await tester.pumpAndSettle();

    final RecordedRequest consulta = api.requests.lastWhere((RecordedRequest r) => r.path == '/parts');
    expect(consulta.query['alert'], 'OUT');
  });

  testWidgets('test_los_pagos_abren_el_listado_de_pagos', (WidgetTester tester) async {
    final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson()));
    await abrirPanel(tester, api);

    await tester.tap(find.text('Cobrado hoy'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/payments'), isTrue);
  });

  testWidgets('test_no_se_desborda_en_una_ventana_de_800_px', (WidgetTester tester) async {
    final FakeApi api = apiCon((RecordedRequest r) => jsonData(dashboardJson()));
    await abrirPanel(tester, api, tamano: const Size(800, 2400));

    expect(find.text('Cobrado hoy'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
