import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirApp(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_muestra_un_unico_campo_para_usuario_o_correo', (WidgetTester tester) async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(<String, dynamic>{}));
    await abrirApp(tester, api);

    expect(find.text('Usuario o correo electrónico'), findsOneWidget);
    expect(find.text('Contraseña'), findsOneWidget);
    expect(find.text('Iniciar sesión'), findsOneWidget);
  });

  testWidgets('test_no_envia_el_formulario_si_faltan_datos', (WidgetTester tester) async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(<String, dynamic>{}));
    await abrirApp(tester, api);

    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();

    expect(find.text('Ingresa el usuario o correo electrónico.'), findsOneWidget);
    expect(find.text('Ingresa la contraseña.'), findsOneWidget);
    expect(api.requests, isEmpty, reason: 'no debía llamar a la API con campos vacíos');
  });

  testWidgets('test_muestra_el_error_del_servidor_cuando_las_credenciales_son_invalidas',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi((RecordedRequest r) =>
        jsonError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.'));
    await abrirApp(tester, api);

    await tester.enterText(find.byType(TextFormField).at(0), 'recepcion');
    await tester.enterText(find.byType(TextFormField).at(1), 'mala');
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();

    expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget);
    expect(api.requests.single.body?['identifier'], 'recepcion');
  });

  testWidgets('test_entra_a_la_aplicacion_tras_un_acceso_correcto', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirApp(tester, api);

    await tester.enterText(find.byType(TextFormField).at(0), 'recepcion@motorix.local');
    await tester.enterText(find.byType(TextFormField).at(1), 'Recepcion2026!');
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();

    expect(find.text('Iniciar sesión'), findsNothing);
    expect(find.text('Clientes'), findsWidgets);
  });
}
