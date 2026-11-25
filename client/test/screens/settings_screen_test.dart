import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> abrir(WidgetTester tester, {String rol = 'ADMIN'}) async {
  final api = ApiAdmin(rol: rol, aceptado: true);
  await bombearApp(tester, api.call);
  await entrar(tester);
  if (rol == 'ADMIN') {
    await tester.tap(find.text('Configuración').first);
    await tester.pumpAndSettle();
  }
  return api;
}

String _texto(WidgetTester tester, String clave) => tester.widget<TextFormField>(find.byKey(Key(clave))).controller!.text;

void main() {
  group('Acceso', () {
    testWidgets('el_administrador_ve_la_seccion_y_las_cuatro_pestanas', (tester) async {
      await abrir(tester);
      for (final pestana in ['Taller', 'Tipos de servicio', 'Términos', 'Bitácora']) {
        expect(find.widgetWithText(Tab, pestana), findsOneWidget);
      }
    });

    for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
      testWidgets('el_rol_${rol}_no_ve_la_seccion_de_configuracion', (tester) async {
        await abrir(tester, rol: rol);
        expect(find.byTooltip('Configuración'), findsNothing);
        expect(find.byTooltip('Reportes'), findsNothing);
      });
    }
  });

  group('Datos del taller y márgenes', () {
    testWidgets('muestra_los_valores_vigentes_y_los_predeterminados', (tester) async {
      await abrir(tester);
      expect(_texto(tester, 'campo-nombre-taller'), 'Taller Motorix');
      expect(_texto(tester, 'campo-telefono-taller'), '5512345678');
      expect(_texto(tester, 'campo-dias-margen'), '15');
      expect(_texto(tester, 'campo-km-margen'), '500');
      expect(find.text('Valores predeterminados: 15 días y 500 km.'), findsOneWidget);
    });

    testWidgets('guardar_esta_deshabilitado_sin_cambios_y_se_habilita_al_editar', (tester) async {
      await abrir(tester);
      expect(tester.widget<FilledButton>(find.byKey(const Key('guardar-configuracion'))).onPressed, isNull);
      await tester.enterText(find.byKey(const Key('campo-nombre-taller')), 'Taller Nuevo');
      await tester.pump();
      expect(tester.widget<FilledButton>(find.byKey(const Key('guardar-configuracion'))).onPressed, isNotNull);
    });

    testWidgets('guarda_y_confirma_enviando_los_datos_del_taller_y_los_margenes', (tester) async {
      final api = await abrir(tester);
      await tester.enterText(find.byKey(const Key('campo-nombre-taller')), 'Taller Nuevo');
      await tester.enterText(find.byKey(const Key('campo-dias-margen')), '30');
      await tester.pump();
      await tester.tap(find.byKey(const Key('guardar-configuracion')));
      await tester.pumpAndSettle();
      final cuerpo = api.enviadas('PUT', '/api/settings').single.body;
      expect(cuerpo, contains('"name":"Taller Nuevo"'));
      expect(cuerpo, contains('"warnDays":30'));
      expect(find.text('Configuración guardada.'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byKey(const Key('guardar-configuracion'))).onPressed, isNull);
    });

    testWidgets('el_nombre_es_obligatorio_y_los_margenes_respetan_sus_limites', (tester) async {
      final api = await abrir(tester);
      await tester.enterText(find.byKey(const Key('campo-nombre-taller')), '');
      await tester.enterText(find.byKey(const Key('campo-dias-margen')), '400');
      await tester.enterText(find.byKey(const Key('campo-km-margen')), '0');
      await tester.pump();
      await tester.tap(find.byKey(const Key('guardar-configuracion')));
      await tester.pump();
      expect(find.text('El nombre del taller es obligatorio.'), findsOneWidget);
      expect(find.text('Los días de margen debe ser un número entero de 1 a 365.'), findsOneWidget);
      expect(find.text('Los kilómetros de margen debe ser un número entero de 1 a 100000.'), findsOneWidget);
      expect(api.enviadas('PUT', '/api/settings'), isEmpty);
    });

    testWidgets('muestra_el_error_del_servidor_junto_al_boton', (tester) async {
      final api = await abrir(tester);
      api.sobrescribir = (p) => p.method == 'PUT'
          ? jsonResponse(400, {
              'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Revisa los datos enviados.',
                'details': [{'field': 'workshop.name', 'message': 'El nombre del taller es obligatorio.'}],
              },
            })
          : null;
      await tester.enterText(find.byKey(const Key('campo-telefono-taller')), '555');
      await tester.pump();
      await tester.tap(find.byKey(const Key('guardar-configuracion')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('error-configuracion')), findsOneWidget);
    });

    testWidgets('si_falla_la_carga_muestra_el_error_en_espanol_y_reintentar_lo_recupera', (tester) async {
      final api = ApiAdmin(rol: 'ADMIN', aceptado: true);
      var fallar = true;
      api.sobrescribir = (p) => (p.url.path == '/api/settings' && fallar)
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Configuración').first);
      await tester.pumpAndSettle();
      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      fallar = false;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Reintentar'));
      await tester.pumpAndSettle();
      expect(_texto(tester, 'campo-nombre-taller'), 'Taller Motorix');
    });
  });
}
