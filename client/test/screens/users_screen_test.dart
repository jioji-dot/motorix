import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/test_app.dart';

Future<void> irAUsuarios(WidgetTester tester) async {
  await entrar(tester);
  await tester.tap(find.text('Usuarios').first);
  await tester.pumpAndSettle();
}

void main() {
  List<Map<String, dynamic>> usuariosBase() => [
        usuarioJson(1, 'admin', 'ADMIN', nombre: 'Ana Administradora'),
        usuarioJson(2, 'recepcion', 'RECEPTIONIST', nombre: 'Rosa Recepción'),
        usuarioJson(3, 'mecanico', 'MECHANIC', nombre: 'Mario Mecánico', activo: false),
      ];

  group('Acceso a la sección Usuarios', () {
    testWidgets('el_administrador_ve_la_seccion_usuarios_en_la_barra_lateral', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase()).call);
      await entrar(tester);

      expect(find.text('Usuarios'), findsWidgets);
    });

    testWidgets('el_recepcionista_y_el_mecanico_no_ven_la_seccion_usuarios', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'RECEPTIONIST').call);
      await entrar(tester);
      expect(find.text('Usuarios'), findsNothing);
      expect(find.text('Clientes'), findsWidgets);
      expect(find.text('Vehículos'), findsWidgets);
    });

    testWidgets('el_mecanico_tampoco_ve_la_seccion_usuarios', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'MECHANIC').call);
      await entrar(tester);
      expect(find.text('Usuarios'), findsNothing);
    });
  });

  group('Lista de usuarios', () {
    testWidgets('muestra_nombre_usuario_rol_y_estado', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase()).call);
      await irAUsuarios(tester);

      expect(find.text('Ana Administradora'), findsOneWidget);
      expect(find.text('Rosa Recepción'), findsOneWidget);
      expect(find.text('Administrador'), findsWidgets);
      expect(find.text('Recepcionista'), findsWidgets);
      expect(find.text('Inactivo'), findsOneWidget);
    });

    testWidgets('muestra_el_error_de_la_api_con_opcion_de_reintentar', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      api.sobrescribir = (p) => p.url.path == '/api/users' && p.method == 'GET'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  group('Formulario de usuario', () {
    testWidgets('valida_usuario_correo_y_politica_de_contrasena_en_espanol', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar usuario').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-usuario')), 'ab');
      await tester.enterText(find.byKey(const Key('campo-correo')), 'no-es-correo');
      await tester.enterText(find.byKey(const Key('campo-contrasena-usuario')), 'corta');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El nombre de usuario debe tener al menos 3 caracteres.'), findsOneWidget);
      expect(find.text('El nombre es obligatorio.'), findsOneWidget);
      expect(find.text('El correo no tiene un formato válido.'), findsOneWidget);
      expect(find.text('La contraseña debe tener al menos 8 caracteres.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/users'), isEmpty);
    });

    testWidgets('crea_el_usuario_con_el_rol_elegido', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar usuario').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-usuario')), 'mecanico2');
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Segundo Mecánico');
      await tester.enterText(find.byKey(const Key('campo-correo')), 'mecanico2@taller.mx');
      await tester.enterText(find.byKey(const Key('campo-contrasena-usuario')), 'Taller2026ok');
      await tester.tap(find.byKey(const Key('campo-rol')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mecánico').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/users').single.body) as Map<String, dynamic>;
      expect(alta, containsPair('username', 'mecanico2'));
      expect(alta, containsPair('role', 'MECHANIC'));
      expect(find.text('Usuario registrado correctamente.'), findsOneWidget);
      expect(find.text('Segundo Mecánico'), findsOneWidget);
    });

    testWidgets('muestra_el_mensaje_cuando_el_usuario_ya_existe', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      api.sobrescribir = (p) => p.method == 'POST' && p.url.path == '/api/users'
          ? jsonResponse(409, {
              'error': {
                'code': 'DUPLICATE_VALUE',
                'message': 'Ya existe un usuario con ese nombre de usuario.',
                'details': [
                  {'field': 'username', 'message': 'Ya existe un usuario con ese nombre de usuario.'},
                ],
              },
            })
          : null;
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar usuario').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-usuario')), 'admin');
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Otro');
      await tester.enterText(find.byKey(const Key('campo-correo')), 'otro@taller.mx');
      await tester.enterText(find.byKey(const Key('campo-contrasena-usuario')), 'Taller2026ok');
      await tester.tap(find.byKey(const Key('campo-rol')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mecánico').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Ya existe un usuario con ese nombre de usuario.'), findsOneWidget);
    });

    testWidgets('en_la_edicion_el_nombre_de_usuario_no_se_puede_cambiar', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase()).call);
      await irAUsuarios(tester);

      await tester.tap(find.byTooltip('Editar').first);
      await tester.pumpAndSettle();

      final campo = tester.widget<TextFormField>(find.byKey(const Key('campo-usuario')));
      expect(campo.enabled, isFalse);
    });
  });

  group('Activar y desactivar usuarios', () {
    testWidgets('desactivar_pide_confirmacion_y_solo_entonces_envia_el_cambio', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.byTooltip('Desactivar').first);
      await tester.pumpAndSettle();
      expect(find.text('Desactivar usuario'), findsOneWidget);
      expect(find.text('Cancelar'), findsOneWidget);
      expect(api.enviadas('PATCH', '/api/users/1'), isEmpty);

      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(jsonDecode(api.enviadas('PATCH', '/api/users/1').single.body), containsPair('active', false));
      expect(find.text('Usuario desactivado.'), findsOneWidget);
    });

    testWidgets('cancelar_la_confirmacion_no_modifica_al_usuario', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.byTooltip('Desactivar').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('PATCH', '/api/users/1'), isEmpty);
    });

    testWidgets('si_es_el_ultimo_administrador_muestra_el_mensaje_claro_de_la_api', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      api.sobrescribir = (p) => p.method == 'PATCH' && p.url.path == '/api/users/1'
          ? jsonResponse(409, {
              'error': {
                'code': 'LAST_ADMIN',
                'message': 'No puedes desactivar ni quitar el rol al único administrador activo.',
              },
            })
          : null;
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.byTooltip('Desactivar').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('único administrador activo'), findsOneWidget);
    });

    testWidgets('reactivar_a_un_usuario_inactivo_no_pide_confirmacion', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', usuarios: usuariosBase());
      await bombearApp(tester, api.call);
      await irAUsuarios(tester);

      await tester.tap(find.byTooltip('Reactivar').first);
      await tester.pumpAndSettle();

      expect(jsonDecode(api.enviadas('PATCH', '/api/users/3').single.body), containsPair('active', true));
      expect(find.text('Usuario reactivado.'), findsOneWidget);
    });
  });
}
