import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> abrir(WidgetTester tester, {List<Map<String, dynamic>>? bitacora}) async {
  final api = ApiAdmin(rol: 'ADMIN', aceptado: true, bitacora: bitacora);
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Configuración').first);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(Tab, 'Bitácora'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('muestra_fecha_usuario_accion_y_entidad_sin_botones_de_edicion', (tester) async {
    await abrir(tester);
    expect(find.text('Cambio de rol'), findsOneWidget);
    expect(find.text('Cambio de configuración'), findsOneWidget);
    expect(find.text('Administrador'), findsWidgets);
    expect(find.text('user #3'), findsOneWidget);
    expect(find.byTooltip('Editar'), findsNothing);
    expect(find.byTooltip('Eliminar'), findsNothing);
    expect(find.textContaining('Exportar'), findsNothing);
    expect(find.text('2 registros'), findsOneWidget);
  });

  testWidgets('filtra_por_accion', (tester) async {
    final api = await abrir(tester);
    await tester.tap(find.byKey(const Key('filtro-accion')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cambio de configuración').last);
    await tester.pumpAndSettle();
    expect(api.enviadas('GET', '/api/audit-log').last.url.queryParameters['action'], 'SETTINGS_CHANGED');
    expect(find.text('Cambio de rol'), findsNothing);
  });

  testWidgets('sin_registros_muestra_el_estado_vacio', (tester) async {
    await abrir(tester, bitacora: []);
    expect(find.text('Todavía no hay registros'), findsOneWidget);
  });

  testWidgets('si_falla_muestra_el_error_en_espanol_y_reintentar_lo_recupera', (tester) async {
    final api = ApiAdmin(rol: 'ADMIN', aceptado: true);
    var fallar = true;
    api.sobrescribir = (p) => (p.url.path == '/api/audit-log' && fallar)
        ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
        : null;
    await bombearApp(tester, api.call);
    await entrar(tester);
    await tester.tap(find.text('Configuración').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(Tab, 'Bitácora'));
    await tester.pumpAndSettle();
    expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
    fallar = false;
    await tester.tap(find.widgetWithText(OutlinedButton, 'Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('Cambio de rol'), findsOneWidget);
  });
}
