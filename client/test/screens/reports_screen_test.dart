import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/services/external_links.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> abrir(WidgetTester tester, {String rol = 'ADMIN', Map<String, dynamic>? reportes}) async {
  final api = ApiAdmin(rol: rol, aceptado: true);
  if (reportes != null) api.reportes = reportes;
  await bombearApp(tester, api.call);
  await entrar(tester);
  if (rol == 'ADMIN') {
    await tester.tap(find.text('Reportes').first);
    await tester.pumpAndSettle();
  }
  return api;
}

Future<void> elegir(WidgetTester tester, String clave) async {
  await tester.tap(find.byKey(Key('reporte-$clave')));
  await tester.pumpAndSettle();
}

void main() {
  group('Acceso', () {
    testWidgets('el_administrador_ve_la_seccion_y_el_reporte_de_ingresos_se_calcula_al_abrirla', (tester) async {
      final api = await abrir(tester);
      expect(api.enviadas('GET', '/api/reports/income'), hasLength(1));
      expect(find.text('\$400.00'), findsWidgets);
    });

    for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
      testWidgets('el_rol_${rol}_no_ve_la_seccion_de_reportes', (tester) async {
        await abrir(tester, rol: rol);
        expect(find.byTooltip('Reportes'), findsNothing);
      });
    }
  });

  group('Ingresos', () {
    testWidgets('muestra_el_total_el_desglose_por_metodo_y_por_periodo', (tester) async {
      await abrir(tester);
      expect(find.text('Efectivo'), findsOneWidget);
      expect(find.text('Tarjeta'), findsOneWidget);
      expect(find.text('23/11/2026'), findsOneWidget);
      expect(find.text('\$250.55'), findsOneWidget);
    });

    testWidgets('agrupar_por_mes_vuelve_a_consultar_con_groupBy_month', (tester) async {
      final api = await abrir(tester);
      await tester.tap(find.text('Por mes'));
      await tester.pumpAndSettle();
      expect(api.enviadas('GET', '/api/reports/income').last.url.queryParameters['groupBy'], 'month');
    });

    testWidgets('sin_ingresos_muestra_el_estado_vacio', (tester) async {
      await abrir(tester, reportes: {...reportesDeEjemplo(), 'income': {'total': '0.00', 'byMethod': [], 'byPeriod': []}});
      expect(find.text('No hay información en este periodo'), findsOneWidget);
    });

    testWidgets('un_rango_invalido_muestra_el_mensaje_del_servidor', (tester) async {
      await abrir(tester);
      await tester.enterText(find.byKey(const Key('campo-desde')), '2026-12-31');
      await tester.enterText(find.byKey(const Key('campo-hasta')), '2026-01-01');
      await tester.tap(find.byKey(const Key('consultar-reporte')));
      await tester.pumpAndSettle();
      expect(find.text('La fecha final no puede ser anterior a la inicial.'), findsOneWidget);
    });

    testWidgets('los_atajos_de_mes_cambian_el_rango_consultado', (tester) async {
      final api = await abrir(tester);
      await tester.tap(find.byKey(const Key('atajo-anio')));
      await tester.pumpAndSettle();
      final q = api.enviadas('GET', '/api/reports/income').last.url.queryParameters;
      final dias = DateTime.parse(q['to']!).difference(DateTime.parse(q['from']!)).inDays + 1;
      expect(dias, 365);
    });

    testWidgets('si_falla_muestra_el_error_en_espanol_y_reintentar_lo_recupera', (tester) async {
      final api = ApiAdmin(rol: 'ADMIN', aceptado: true);
      var fallar = true;
      api.sobrescribir = (p) => (p.url.path == '/api/reports/income' && fallar)
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Reportes').first);
      await tester.pumpAndSettle();
      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      fallar = false;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('Efectivo'), findsOneWidget);
    });
  });

  group('Otros reportes', () {
    testWidgets('servicios_frecuentes', (tester) async {
      await abrir(tester);
      await elegir(tester, 'services');
      expect(find.text('Cambio de aceite'), findsOneWidget);
      expect(find.text('\$410.00'), findsOneWidget);
    });

    testWidgets('productividad_por_mecanico', (tester) async {
      await abrir(tester);
      await elegir(tester, 'productivity');
      expect(find.text('Mario Mecánico'), findsOneWidget);
      expect(find.text('\$1,225.00'), findsWidgets);
    });

    testWidgets('refacciones_con_la_marca_sin_costo_y_sus_totales', (tester) async {
      await abrir(tester);
      await elegir(tester, 'parts');
      expect(find.text('Sin costo'), findsOneWidget);
      expect(find.text('\$130.25'), findsWidgets);
      expect(find.textContaining('Margen \$130.25'), findsOneWidget);
    });

    testWidgets('rotacion_con_existencia_cero_dice_sin_existencia', (tester) async {
      await abrir(tester);
      await elegir(tester, 'rotation');
      expect(find.text('Sin existencia'), findsOneWidget);
      expect(find.text('0.3'), findsOneWidget);
    });
  });

  group('Exportar', () {
    testWidgets('pide_el_enlace_y_lo_abre_con_la_direccion_completa', (tester) async {
      final abiertas = <Uri>[];
      final original = openExternalUrl;
      openExternalUrl = (u) async {
        abiertas.add(u);
        return true;
      };
      addTearDown(() => openExternalUrl = original);
      final api = await abrir(tester);
      await tester.tap(find.byKey(const Key('exportar-reporte')));
      await tester.pumpAndSettle();
      expect(api.enviadas('GET', '/api/reports/income/export-link'), hasLength(1));
      expect(abiertas.single.toString(), 'http://prueba/api/reports/export/token-de-prueba');
    });

    testWidgets('si_no_se_puede_abrir_avisa_con_un_mensaje', (tester) async {
      final original = openExternalUrl;
      openExternalUrl = (_) async => false;
      addTearDown(() => openExternalUrl = original);
      await abrir(tester);
      await tester.tap(find.byKey(const Key('exportar-reporte')));
      await tester.pumpAndSettle();
      expect(find.text('No se pudo abrir la descarga. Intenta de nuevo.'), findsOneWidget);
    });
  });
}
