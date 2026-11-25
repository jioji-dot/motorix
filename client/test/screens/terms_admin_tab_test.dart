import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';
import '../helpers/fake_api.dart';

Future<ApiAdmin> abrir(WidgetTester tester) async {
  final api = ApiAdmin(rol: 'ADMIN', terminos: terminosJson(), aceptado: true);
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Configuración').first);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(Tab, 'Términos'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('muestra_la_version_vigente_y_quien_acepto_y_quien_falta', (tester) async {
    await abrir(tester);
    expect(find.text('Versión vigente: 1'), findsOneWidget);
    expect(find.text('Aceptaron (1)'), findsOneWidget);
    expect(find.text('Faltan por aceptar (1)'), findsOneWidget);
    expect(find.text('Recepción'), findsOneWidget);
  });

  testWidgets('publicar_esta_deshabilitado_sin_textos_y_pide_confirmacion_al_publicar', (tester) async {
    final api = await abrir(tester);
    final publicar = find.byKey(const Key('publicar-terminos'));
    await tester.ensureVisible(publicar);
    expect(tester.widget<FilledButton>(publicar).onPressed, isNull);
    await tester.enterText(find.byKey(const Key('campo-terminos')), 'Nuevos términos');
    await tester.enterText(find.byKey(const Key('campo-privacidad')), 'Nuevo aviso');
    await tester.pump();
    await tester.tap(publicar);
    await tester.pumpAndSettle();
    expect(find.textContaining('aceptar la versión nueva'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Publicar'));
    await tester.pumpAndSettle();
    expect(api.enviadas('POST', '/api/terms').single.body, contains('"termsText":"Nuevos términos"'));
    expect(find.text('Versión vigente: 2'), findsOneWidget);
  });

  testWidgets('si_el_servidor_rechaza_la_publicacion_muestra_su_mensaje', (tester) async {
    final api = await abrir(tester);
    api.sobrescribir = (p) => (p.url.path == '/api/terms' && p.method == 'POST')
        ? jsonResponse(400, {'error': {'code': 'VALIDATION_ERROR', 'message': 'Revisa los datos enviados.', 'details': [{'field': 'termsText', 'message': 'El texto de los términos es obligatorio.'}]}})
        : null;
    await tester.enterText(find.byKey(const Key('campo-terminos')), 'x');
    await tester.enterText(find.byKey(const Key('campo-privacidad')), 'y');
    await tester.pump();
    final publicar = find.byKey(const Key('publicar-terminos'));
    await tester.ensureVisible(publicar);
    await tester.tap(publicar);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Publicar'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('error-terminos')), findsOneWidget);
  });
}
