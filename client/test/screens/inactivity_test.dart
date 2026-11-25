import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> iniciar(WidgetTester tester) async {
  final api = ApiAdmin(rol: 'ADMIN', aceptado: true);
  await bombearApp(tester, api.call);
  await entrar(tester);
  return api;
}

const mensaje = 'Tu sesión se cerró por inactividad. Inicia sesión de nuevo.';

void main() {
  testWidgets('sin_interaccion_durante_30_minutos_la_sesion_se_cierra_con_el_mensaje', (tester) async {
    await iniciar(tester);
    expect(find.byKey(const Key('campana')), findsOneWidget);
    await tester.pump(const Duration(minutes: 29, seconds: 59));
    expect(find.byKey(const Key('campana')), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campo-identificador')), findsOneWidget);
    expect(find.text(mensaje), findsOneWidget);
  });

  testWidgets('tocar_la_pantalla_reinicia_el_temporizador', (tester) async {
    await iniciar(tester);
    await tester.pump(const Duration(minutes: 20));
    await tester.tapAt(const Offset(700, 450));
    await tester.pump(const Duration(minutes: 20));
    expect(find.byKey(const Key('campana')), findsOneWidget); // 40 minutos en total, pero con un toque a los 20
    await tester.pump(const Duration(minutes: 11));
    await tester.pumpAndSettle();
    expect(find.text(mensaje), findsOneWidget);
  });

  testWidgets('escribir_en_el_teclado_reinicia_el_temporizador', (tester) async {
    await iniciar(tester);
    await tester.pump(const Duration(minutes: 25));
    await tester.sendKeyEvent(LogicalKeyboardKey.keyA);
    await tester.pump(const Duration(minutes: 25));
    expect(find.byKey(const Key('campana')), findsOneWidget);
  });

  testWidgets('una_respuesta_SESSION_INACTIVE_del_servidor_cierra_la_sesion_con_el_mismo_mensaje', (tester) async {
    final api = await iniciar(tester);
    api.sesionInactiva = true;
    await tester.tap(find.text('Clientes').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campo-identificador')), findsOneWidget);
    expect(find.text(mensaje), findsOneWidget);
  });

  testWidgets('despues_de_iniciar_sesion_de_nuevo_el_mensaje_desaparece', (tester) async {
    await iniciar(tester);
    await tester.pump(const Duration(minutes: 31));
    await tester.pumpAndSettle();
    expect(find.text(mensaje), findsOneWidget);
    await entrar(tester);
    expect(find.text(mensaje), findsNothing);
    expect(find.byKey(const Key('campana')), findsOneWidget);
  });
}
