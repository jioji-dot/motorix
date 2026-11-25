import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> iniciar(WidgetTester tester, {String rol = 'RECEPTIONIST', bool conTerminos = true, bool aceptado = false}) async {
  final api = ApiAdmin(rol: rol, terminos: conTerminos ? terminosJson() : null, aceptado: aceptado);
  await bombearApp(tester, api.call);
  await entrar(tester);
  return api;
}

void main() {
  testWidgets('al_iniciar_sesion_sin_aceptacion_aparece_la_pantalla_con_los_terminos_y_el_aviso', (tester) async {
    await iniciar(tester);
    expect(find.text('Términos y condiciones y aviso de privacidad'), findsOneWidget);
    expect(find.textContaining('Uso permitido del sistema'), findsOneWidget);
    expect(find.textContaining('AVISO DE PRIVACIDAD'), findsOneWidget);
    expect(find.text('Versión 1 · 25/11/2026'), findsOneWidget);
    expect(find.byKey(const Key('campana')), findsNothing); // todavía no se ve la aplicación
  });

  testWidgets('aceptar_registra_la_aceptacion_y_entra_a_la_aplicacion', (tester) async {
    final api = await iniciar(tester);
    await tester.tap(find.byKey(const Key('aceptar-terminos')));
    await tester.pumpAndSettle();
    expect(api.enviadas('POST', '/api/terms/accept'), hasLength(1));
    expect(find.text('Términos y condiciones y aviso de privacidad'), findsNothing);
    expect(find.byKey(const Key('campana')), findsOneWidget);
  });

  testWidgets('rechazar_cierra_la_sesion_y_no_entra', (tester) async {
    final api = await iniciar(tester);
    await tester.tap(find.byKey(const Key('rechazar-terminos')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campo-identificador')), findsOneWidget); // volvió al inicio de sesión
    expect(api.enviadas('POST', '/api/terms/accept'), isEmpty);
  });

  testWidgets('si_ya_acepto_la_version_vigente_entra_directo', (tester) async {
    await iniciar(tester, aceptado: true);
    expect(find.text('Términos y condiciones y aviso de privacidad'), findsNothing);
    expect(find.byKey(const Key('campana')), findsOneWidget);
  });

  testWidgets('sin_version_publicada_no_se_pide_nada', (tester) async {
    await iniciar(tester, conTerminos: false);
    expect(find.byKey(const Key('campana')), findsOneWidget);
  });

  testWidgets('si_una_peticion_responde_TERMS_NOT_ACCEPTED_con_la_sesion_abierta_aparece_la_pantalla', (tester) async {
    final api = await iniciar(tester, aceptado: true);
    expect(find.byKey(const Key('campana')), findsOneWidget);
    // El administrador publicó una versión nueva: la siguiente petición exige aceptarla.
    api.terminos = terminosJson(version: 2);
    api.aceptado = false;
    await tester.tap(find.text('Clientes').first);
    await tester.pumpAndSettle();
    expect(find.text('Términos y condiciones y aviso de privacidad'), findsOneWidget);
    expect(find.text('Versión 2 · 25/11/2026'), findsOneWidget);
  });

  testWidgets('si_falla_la_carga_de_los_terminos_muestra_el_error_con_reintentar', (tester) async {
    final api = ApiAdmin(rol: 'RECEPTIONIST', terminos: terminosJson(), aceptado: false);
    var fallar = false;
    api.sobrescribir = (p) => (p.url.path == '/api/terms/current' && fallar)
        ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
        : null;
    await bombearApp(tester, api.call);
    await entrar(tester); // la primera consulta funciona
    api.terminos = terminosJson(version: 2);
    fallar = true;
    api.aceptado = false;
    await tester.tap(find.byKey(const Key('rechazar-terminos')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campo-identificador')), findsOneWidget);
  });
}
