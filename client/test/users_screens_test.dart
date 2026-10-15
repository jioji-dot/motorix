import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirComoAdmin(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'admin');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

Future<void> irAUsuarios(WidgetTester tester) async {
  await tester.tap(find.text('Usuarios'));
  await tester.pumpAndSettle();
}

Finder campo(String etiqueta) => find.widgetWithText(TextFormField, etiqueta);

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

FakeHandler handlerAdmin({http.Response? Function(RecordedRequest)? extra}) => baseHandler(
      role: 'ADMIN',
      extra: (RecordedRequest r) {
        final http.Response? response = extra?.call(r);
        if (response != null) return response;
        if (r.path == '/users' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[
            userJson(id: 1, username: 'usuario', name: 'Persona de prueba', role: 'ADMIN'),
            userJson(id: 2, username: 'meca', name: 'Mario Mecánico', role: 'MECHANIC'),
          ]);
        }
        return null;
      },
    );

void main() {
  testWidgets('test_el_administrador_ve_el_listado_con_rol_y_estado', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handlerAdmin());
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);

    expect(find.text('Mario Mecánico'), findsOneWidget);
    expect(find.text('Mecánico'), findsWidgets);
    expect(find.text('Activo'), findsWidgets);
    expect(find.text('Nuevo usuario'), findsOneWidget);
  });

  testWidgets('test_el_alta_exige_la_politica_de_contrasena_y_su_confirmacion', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handlerAdmin());
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);
    await tester.tap(find.text('Nuevo usuario'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Usuario *'), 'nuevo');
    await tester.enterText(campo('Nombre *'), 'Nuevo Usuario');
    await tester.enterText(campo('Correo electrónico *'), 'nuevo@motorix.local');
    await tester.enterText(campo('Contraseña *'), 'sinmayuscula1');
    await tester.enterText(campo('Confirmar contraseña *'), 'otra');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Usa al menos 8 caracteres'), findsWidgets);
    expect(find.text('Las contraseñas no coinciden.'), findsOneWidget);
    expect(api.requests.where((RecordedRequest r) => r.method == 'POST' && r.path == '/users'), isEmpty);
  });

  testWidgets('test_registra_un_usuario_y_muestra_el_mensaje_de_exito', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handlerAdmin(extra: (RecordedRequest r) {
      if (r.method == 'POST' && r.path == '/users') {
        return jsonData(userJson(id: 9, username: 'nuevo', role: 'MECHANIC'), status: 201);
      }
      return null;
    }));
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);
    await tester.tap(find.text('Nuevo usuario'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Usuario *'), 'nuevo');
    await tester.enterText(campo('Nombre *'), 'Nuevo Usuario');
    await tester.enterText(campo('Correo electrónico *'), 'nuevo@motorix.local');
    await tester.enterText(campo('Contraseña *'), 'Taller2026');
    await tester.enterText(campo('Confirmar contraseña *'), 'Taller2026');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest alta =
        api.requests.firstWhere((RecordedRequest r) => r.method == 'POST' && r.path == '/users');
    expect(alta.body!['username'], 'nuevo');
    expect(alta.body!['role'], 'RECEPTIONIST');
    expect(alta.body!['password'], 'Taller2026');
    expect(find.text('Usuario registrado correctamente.'), findsOneWidget);
  });

  testWidgets('test_muestra_el_error_de_usuario_repetido_junto_al_campo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handlerAdmin(extra: (RecordedRequest r) {
      if (r.method == 'POST' && r.path == '/users') {
        return jsonError(409, 'DUPLICATE_USERNAME', 'Ya existe un usuario con ese nombre de usuario.',
            details: <String, dynamic>{'field': 'username'});
      }
      return null;
    }));
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);
    await tester.tap(find.text('Nuevo usuario'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Usuario *'), 'meca');
    await tester.enterText(campo('Nombre *'), 'Otro');
    await tester.enterText(campo('Correo electrónico *'), 'otro@motorix.local');
    await tester.enterText(campo('Contraseña *'), 'Taller2026');
    await tester.enterText(campo('Confirmar contraseña *'), 'Taller2026');

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ya existe un usuario con ese nombre de usuario.'), findsOneWidget);
  });

  testWidgets('test_desactivar_un_usuario_pide_confirmacion_antes_de_guardar', (WidgetTester tester) async {
    int ediciones = 0;
    final FakeApi api = FakeApi(handlerAdmin(extra: (RecordedRequest r) {
      if (r.method == 'PATCH' && r.path == '/users/2') {
        ediciones++;
        return jsonData(userJson(id: 2, username: 'meca', role: 'MECHANIC', active: false));
      }
      return null;
    }));
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);
    await tester.tap(find.text('Mario Mecánico'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Desactivar usuario'), findsOneWidget);
    expect(ediciones, 0, reason: 'no debía guardar antes de confirmar');

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();
    expect(ediciones, 0);

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(ediciones, 1);
    final RecordedRequest patch = api.requests.firstWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(patch.body!['active'], isFalse);
    expect(patch.body!.containsKey('username'), isFalse);
  });

  testWidgets('test_un_administrador_no_puede_cambiar_su_propio_rol_ni_desactivarse',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(handlerAdmin());
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);
    // El nombre también aparece en el encabezado y el sidebar: se toca el de la tabla.
    await tester.tap(find.descendant(
      of: find.byType(DataTable),
      matching: find.text('Persona de prueba'),
    ));
    await tester.pumpAndSettle();

    expect(
      find.text('No puedes desactivar tu propia cuenta ni cambiar tu propio rol.'),
      findsOneWidget,
    );
    final Switch interruptor = tester.widget<Switch>(find.byType(Switch));
    expect(interruptor.onChanged, isNull);
    expect(find.text('Restablecer contraseña'), findsNothing);
  });

  testWidgets('test_restablece_la_contrasena_de_otro_usuario', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handlerAdmin(extra: (RecordedRequest r) {
      if (r.method == 'POST' && r.path == '/users/2/reset-password') {
        return jsonData(null, status: 204);
      }
      return null;
    }));
    await abrirComoAdmin(tester, api);
    await irAUsuarios(tester);
    await tester.tap(find.text('Mario Mecánico'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Restablecer contraseña'));
    await tester.pumpAndSettle();

    final Finder nuevaContrasena = find.descendant(
      of: find.byType(AlertDialog),
      matching: find.widgetWithText(TextFormField, 'Contraseña nueva'),
    );
    final Finder confirmacion = find.descendant(
      of: find.byType(AlertDialog),
      matching: find.widgetWithText(TextFormField, 'Confirmar contraseña nueva'),
    );
    await tester.enterText(nuevaContrasena, 'debil');
    await tester.enterText(confirmacion, 'debil');
    await tester.tap(botonDelDialogo('Restablecer'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Usa al menos 8 caracteres'), findsWidgets);

    await tester.enterText(nuevaContrasena, 'Nueva2026Clave');
    await tester.enterText(confirmacion, 'Nueva2026Clave');
    await tester.tap(botonDelDialogo('Restablecer'));
    await tester.pumpAndSettle();

    final RecordedRequest reset = api.requests
        .firstWhere((RecordedRequest r) => r.path == '/users/2/reset-password');
    expect(reset.body!['newPassword'], 'Nueva2026Clave');
    expect(find.text('Contraseña restablecida correctamente.'), findsOneWidget);
  });
}
