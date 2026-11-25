import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/widgets/notification_bell.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s6.dart';
import '../helpers/test_app.dart';

Future<ApiAvisos> abrir(WidgetTester tester, {String rol = 'ADMIN', List<Map<String, dynamic>>? grupos}) async {
  final api = ApiAvisos(rol: rol, grupos: grupos);
  await bombearApp(tester, api.call);
  await entrar(tester);
  return api;
}

Finder get contador => find.byKey(const Key('contador-avisos'));

void main() {
  group('Contador de la campana', () {
    testWidgets('muestra_el_numero_de_avisos_no_leidos_y_la_descripcion_emergente', (tester) async {
      await abrir(tester);
      expect(find.byKey(const Key('campana')), findsOneWidget);
      expect(find.byTooltip('Notificaciones'), findsOneWidget);
      expect(tester.widget<Text>(contador).data, '4');
    });

    test('muestra_99_mas_cuando_pasa_de_99', () {
      expect(NotificationBell.countLabel(0), '0');
      expect(NotificationBell.countLabel(99), '99');
      expect(NotificationBell.countLabel(100), '99+');
      expect(NotificationBell.countLabel(2500), '99+');
    });

    testWidgets('sin_avisos_no_muestra_numero', (tester) async {
      await abrir(tester, grupos: []);
      expect(contador, findsNothing);
      expect(find.byTooltip('Notificaciones'), findsOneWidget);
    });

    testWidgets('si_falla_la_consulta_la_campana_no_muestra_numero_ni_mensajes', (tester) async {
      final api = ApiAvisos(rol: 'ADMIN');
      api.sobrescribir = (p) => p.url.path == '/api/notifications'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Fallo del servidor.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      expect(contador, findsNothing);
      expect(find.byType(SnackBar), findsNothing);
    });

    testWidgets('se_actualiza_cada_60_segundos_mientras_la_sesion_esta_abierta', (tester) async {
      final api = await abrir(tester);
      final inicial = api.enviadas('GET', '/api/notifications').length;
      await tester.pump(const Duration(seconds: 60));
      await tester.pump();
      expect(api.enviadas('GET', '/api/notifications').length, inicial + 1);
    });

    testWidgets('al_cambiar_de_seccion_se_actualiza_el_contador', (tester) async {
      final api = await abrir(tester);
      final inicial = api.enviadas('GET', '/api/notifications').length;
      await tester.tap(find.text('Vehículos').first);
      await tester.pumpAndSettle();
      expect(api.enviadas('GET', '/api/notifications').length, greaterThan(inicial));
    });
  });

  group('Panel de avisos', () {
    testWidgets('agrupa_los_avisos_por_tipo_con_su_total', (tester) async {
      await abrir(tester);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('panel-de-avisos')), findsOneWidget);
      for (final titulo in [
        'Mantenimientos vencidos (1)',
        'Citas de hoy (1)',
        'Refacciones agotadas (1)',
        'Órdenes detenidas (1)',
      ]) {
        expect(find.text(titulo), findsOneWidget);
      }
      expect(find.text('Cambio de aceite vencido'), findsOneWidget);
      expect(find.text('Vencido'), findsOneWidget);
    });

    testWidgets('los_avisos_del_panel_no_muestran_telefonos', (tester) async {
      await abrir(tester);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      expect(find.textContaining(RegExp(r'\d{10}')), findsNothing);
    });

    testWidgets('con_mas_avisos_de_los_que_muestra_indica_cuantos_hay_en_el_modulo', (tester) async {
      await abrir(tester, grupos: [
        grupoJson('ORDER_STALLED', [avisoJson('ORDEN:1', 'ORDER_STALLED', 'Orden OS-000001 detenida')], total: 14),
      ]);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      expect(find.text('Órdenes detenidas (14)'), findsOneWidget);
      expect(find.text('y 13 más en el módulo'), findsOneWidget);
    });

    testWidgets('sin_avisos_muestra_el_estado_vacio', (tester) async {
      await abrir(tester, grupos: []);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      expect(find.text('No tienes avisos pendientes'), findsOneWidget);
    });

    testWidgets('si_falla_muestra_el_error_en_espanol_y_reintentar_lo_recupera', (tester) async {
      final api = ApiAvisos(rol: 'ADMIN');
      var fallar = true;
      api.sobrescribir = (p) => (p.url.path == '/api/notifications' && fallar)
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      fallar = false;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('Órdenes detenidas (1)'), findsOneWidget);
    });

    testWidgets('la_tecla_escape_cierra_el_panel', (tester) async {
      await abrir(tester);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('panel-de-avisos')), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('panel-de-avisos')), findsNothing);
    });

    testWidgets('el_boton_cerrar_cierra_el_panel', (tester) async {
      await abrir(tester);
      await tester.tap(find.byKey(const Key('campana')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Cerrar'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('panel-de-avisos')), findsNothing);
    });
  });
}
