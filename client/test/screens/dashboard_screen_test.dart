import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s4.dart';
import '../helpers/test_app.dart';

Future<ApiCobros> abrirPanel(WidgetTester tester, {String rol = 'ADMIN', Map<String, dynamic>? panel}) async {
  final api = ApiCobros(rol: rol, panel: panel);
  await bombearApp(tester, api.call);
  await entrar(tester);
  if (rol == 'ADMIN') {
    await tester.tap(find.text('Panel de control').first);
    await tester.pumpAndSettle();
  }
  return api;
}

void main() {
  group('Acceso al panel', () {
    testWidgets('el_administrador_ve_la_seccion_y_el_panel_se_calcula_al_abrirlo', (tester) async {
      final api = await abrirPanel(tester);
      expect(find.text('Panel de control'), findsWidgets);
      expect(api.enviadas('GET', '/api/dashboard'), hasLength(1));
      expect(find.byKey(const Key('tarjeta-ordenes')), findsOneWidget);
    });

    for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
      testWidgets('el_rol_${rol}_no_ve_la_seccion_del_panel', (tester) async {
        await abrirPanel(tester, rol: rol);
        expect(find.text('Panel de control'), findsNothing);
        expect(find.byTooltip('Panel de control'), findsNothing);
      });
    }
  });

  group('Estados de la pantalla', () {
    testWidgets('muestra_el_estado_de_carga_mientras_espera_al_servidor', (tester) async {
      final api = ApiCobros(rol: 'ADMIN');
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Panel de control').first);
      await tester.pump();
      expect(find.text('Cargando el panel...'), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.text('Cargando el panel...'), findsNothing);
    });

    testWidgets('si_falla_la_consulta_muestra_el_error_en_espanol_y_reintentar_lo_recupera', (tester) async {
      final api = ApiCobros(rol: 'ADMIN');
      var fallar = true;
      api.sobrescribir = (p) => (p.url.path == '/api/dashboard' && fallar)
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Panel de control').first);
      await tester.pumpAndSettle();

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      fallar = false;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Reintentar'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('tarjeta-ordenes')), findsOneWidget);
    });

    testWidgets('sin_datos_muestra_ceros_y_estados_vacios_sin_errores', (tester) async {
      await abrirPanel(
        tester,
        panel: panelJson(
          ordenes: {},
          ordenesConSaldo: 0,
          montoPorCobrar: '0.00',
          citasHoy: 0,
          citasProximas: 0,
          siguientes: [],
          vencidos: 0,
          proximos: 0,
          bajas: 0,
          agotadas: 0,
          urgentes: [],
          cobradoMes: '0.00',
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Ninguna orden con saldo por cobrar'), findsOneWidget);
      expect(find.text('Sin citas pendientes en los próximos días'), findsOneWidget);
      expect(find.text('Todo el stock está en orden'), findsOneWidget);
      expect(find.text(r'$0.00'), findsWidgets);
    });

    testWidgets('el_boton_de_recarga_vuelve_a_pedir_las_cifras', (tester) async {
      final api = await abrirPanel(tester);
      await tester.tap(find.byKey(const Key('boton-recargar-panel')));
      await tester.pumpAndSettle();
      expect(api.enviadas('GET', '/api/dashboard'), hasLength(2));
    });
  });
}
