import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> abrir(WidgetTester tester, {List<Map<String, dynamic>>? tipos}) async {
  final api = ApiAdmin(rol: 'ADMIN', aceptado: true, tipos: tipos);
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Configuración').first);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(Tab, 'Tipos de servicio'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('lista_los_tipos_con_su_intervalo_y_su_estado', (tester) async {
    await abrir(tester);
    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('180 días · 5,000 km'), findsOneWidget);
    expect(find.text('Frenos'), findsOneWidget);
    expect(find.text('Inactivo'), findsOneWidget);
  });

  testWidgets('sin_tipos_muestra_el_estado_vacio_con_la_accion_para_crear', (tester) async {
    await abrir(tester, tipos: []);
    expect(find.text('Todavía no hay tipos de servicio'), findsOneWidget);
  });

  testWidgets('crea_un_tipo_con_nombre_y_un_intervalo', (tester) async {
    final api = await abrir(tester);
    await tester.tap(find.byKey(const Key('nuevo-tipo')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('campo-nombre-tipo')), 'Afinación');
    await tester.enterText(find.byKey(const Key('campo-km-tipo')), '15000');
    await tester.tap(find.byKey(const Key('guardar-tipo')));
    await tester.pumpAndSettle();
    expect(api.enviadas('POST', '/api/service-types').single.body, contains('"name":"Afinación"'));
    expect(find.text('Tipo de servicio creado.'), findsOneWidget);
    expect(find.text('Afinación'), findsOneWidget);
  });

  testWidgets('exige_al_menos_un_intervalo_y_respeta_los_limites', (tester) async {
    final api = await abrir(tester);
    await tester.tap(find.byKey(const Key('nuevo-tipo')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('campo-nombre-tipo')), 'Sin intervalo');
    await tester.tap(find.byKey(const Key('guardar-tipo')));
    await tester.pump();
    expect(find.text('Indica el intervalo en días, en kilómetros o en ambos.'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('campo-dias-tipo')), '5000');
    await tester.tap(find.byKey(const Key('guardar-tipo')));
    await tester.pump();
    expect(find.text('El intervalo en días debe ser un número entero de 1 a 3650.'), findsOneWidget);
    expect(api.enviadas('POST', '/api/service-types'), isEmpty);
  });

  testWidgets('un_nombre_repetido_muestra_el_error_del_servidor_en_el_dialogo', (tester) async {
    await abrir(tester);
    await tester.tap(find.byKey(const Key('nuevo-tipo')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('campo-nombre-tipo')), 'cambio de aceite');
    await tester.enterText(find.byKey(const Key('campo-dias-tipo')), '10');
    await tester.tap(find.byKey(const Key('guardar-tipo')));
    await tester.pumpAndSettle();
    expect(find.text('Ya existe un tipo de servicio con ese nombre.'), findsOneWidget);
  });

  testWidgets('desactivar_pide_confirmacion_y_activar_no', (tester) async {
    final api = await abrir(tester);
    await tester.tap(find.byKey(const Key('estado-tipo-1')));
    await tester.pumpAndSettle();
    expect(find.textContaining('conservan'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Desactivar'));
    await tester.pumpAndSettle();
    expect(api.enviadas('PATCH', '/api/service-types/1').single.body, contains('"active":false'));
    await tester.tap(find.byKey(const Key('estado-tipo-2')));
    await tester.pumpAndSettle();
    expect(api.enviadas('PATCH', '/api/service-types/2').single.body, contains('"active":true'));
  });
}
