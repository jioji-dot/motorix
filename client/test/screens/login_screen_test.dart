import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/test_app.dart';

void main() {
  group('Pantalla de inicio de sesión', () {
    testWidgets('muestra_un_unico_campo_de_usuario_o_correo_y_el_boton_de_entrar', (tester) async {
      await bombearApp(tester, (_) async => jsonResponse(404, {}));

      expect(find.text('Usuario o correo'), findsOneWidget);
      expect(find.text('Contraseña'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Iniciar sesión'), findsOneWidget);
    });

    testWidgets('muestra_mensajes_en_espanol_cuando_los_campos_estan_vacios', (tester) async {
      await bombearApp(tester, (_) async => jsonResponse(404, {}));

      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar sesión'));
      await tester.pumpAndSettle();

      expect(find.text('Ingresa tu usuario o correo.'), findsOneWidget);
      expect(find.text('Ingresa tu contraseña.'), findsOneWidget);
    });

    testWidgets('muestra_el_error_de_credenciales_incorrectas_sin_detalles_internos', (tester) async {
      await bombearApp(
        tester,
        (_) async => jsonResponse(401, {
          'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Usuario o contraseña incorrectos.'},
        }),
      );

      await tester.enterText(find.byKey(const Key('campo-identificador')), 'recepcion');
      await tester.enterText(find.byKey(const Key('campo-contrasena')), 'Equivocada1');
      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar sesión'));
      await tester.pumpAndSettle();

      expect(find.text('Usuario o contraseña incorrectos.'), findsOneWidget);
      expect(find.text('Usuario o correo'), findsOneWidget); // sigue en el inicio de sesión
    });

    testWidgets('muestra_el_aviso_de_cuenta_bloqueada_con_el_tiempo_de_espera', (tester) async {
      await bombearApp(
        tester,
        (_) async => jsonResponse(423, {
          'error': {
            'code': 'ACCOUNT_LOCKED',
            'message': 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.',
            'retryAfterSeconds': 900,
          },
        }),
      );

      await tester.enterText(find.byKey(const Key('campo-identificador')), 'admin');
      await tester.enterText(find.byKey(const Key('campo-contrasena')), 'Equivocada1');
      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar sesión'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Intenta de nuevo en 15 minutos'), findsOneWidget);
    });

    testWidgets('entra_a_clientes_como_pantalla_inicial_con_un_inicio_de_sesion_correcto', (tester) async {
      final peticiones = <String>[];
      await bombearApp(tester, (peticion) async {
        peticiones.add('${peticion.method} ${peticion.url.path}');
        return apiBasica('RECEPTIONIST')(peticion);
      });

      await tester.enterText(find.byKey(const Key('campo-identificador')), 'recepcion@motorix.mx');
      await tester.enterText(find.byKey(const Key('campo-contrasena')), 'Recepcion2026!');
      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar sesión'));
      await tester.pumpAndSettle();

      expect(peticiones, contains('POST /api/auth/login'));
      expect(find.text('Clientes'), findsWidgets);
      expect(find.text('Recepcionista'), findsWidgets);
      expect(find.text('Usuario o correo'), findsNothing);
    });
  });

  group('Cierre de sesión', () {
    Future<void> iniciarSesion(WidgetTester tester) async {
      await tester.enterText(find.byKey(const Key('campo-identificador')), 'recepcion');
      await tester.enterText(find.byKey(const Key('campo-contrasena')), 'Recepcion2026!');
      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar sesión'));
      await tester.pumpAndSettle();
    }

    Future<void> elegirCerrarSesion(WidgetTester tester) async {
      await tester.tap(find.byTooltip('Menú de usuario'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
    }

    testWidgets('pide_confirmacion_y_conserva_la_sesion_si_se_cancela', (tester) async {
      await bombearApp(tester, apiBasica('RECEPTIONIST'));
      await iniciarSesion(tester);
      await elegirCerrarSesion(tester);

      expect(find.text('Confirmar'), findsOneWidget);
      expect(find.text('Cancelar'), findsOneWidget);

      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Usuario o correo'), findsNothing);
    });

    testWidgets('termina_la_sesion_al_confirmar', (tester) async {
      final api = await bombearApp(tester, apiBasica('RECEPTIONIST'));
      await iniciarSesion(tester);
      await elegirCerrarSesion(tester);

      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(find.text('Usuario o correo'), findsOneWidget);
      expect(api.token, isNull);
    });
  });
}
