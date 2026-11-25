import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s6.dart';
import '../helpers/test_app.dart';

Future<ApiAvisos> abrir(WidgetTester tester, {String rol = 'RECEPTIONIST', List<Map<String, dynamic>>? hechos}) async {
  final api = ApiAvisos(rol: rol, hechos: hechos);
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Clientes por avisar').first);
  await tester.pumpAndSettle();
  return api;
}

Finder insignia(String seccion) => find.descendant(of: find.byKey(Key('insignia-$seccion')), matching: find.byType(Text));

void main() {
  group('Acceso a la sección', () {
    for (final rol in ['ADMIN', 'RECEPTIONIST']) {
      testWidgets('el_rol_${rol}_ve_la_seccion_con_la_insignia_de_pendientes', (tester) async {
        final api = ApiAvisos(rol: rol);
        await bombearApp(tester, api.call);
        await entrar(tester);
        expect(find.byTooltip('Clientes por avisar'), findsOneWidget);
        expect(tester.widget<Text>(insignia('Clientes por avisar')).data, '1');
      });
    }

    testWidgets('el_mecanico_no_ve_la_seccion', (tester) async {
      final api = ApiAvisos(rol: 'MECHANIC');
      await bombearApp(tester, api.call);
      await entrar(tester);
      expect(find.byTooltip('Clientes por avisar'), findsNothing);
    });
  });

  group('Lista', () {
    testWidgets('muestra_cliente_telefono_vehiculo_y_motivo_y_avisa_que_no_envia_mensajes', (tester) async {
      await abrir(tester);
      expect(find.text('María López'), findsOneWidget);
      expect(find.text('Vehículo listo'), findsOneWidget);
      expect(find.text('ABC-123-A · Nissan Versa'), findsOneWidget);
      expect(find.textContaining('5512345678'.substring(6)), findsWidgets); // el teléfono se muestra con formato
      expect(find.textContaining('no envía mensajes'), findsOneWidget);
    });

    testWidgets('sin_clientes_por_avisar_muestra_el_estado_vacio_y_sin_insignia', (tester) async {
      await abrir(tester, hechos: []);
      expect(find.text('No hay clientes por avisar'), findsOneWidget);
      expect(insignia('Clientes por avisar'), findsNothing);
    });

    testWidgets('si_falla_muestra_el_error_en_espanol_y_reintentar_lo_recupera', (tester) async {
      final api = ApiAvisos(rol: 'RECEPTIONIST');
      var fallar = true;
      api.sobrescribir = (p) => (p.url.path == '/api/client-notices' && fallar)
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Clientes por avisar').first);
      await tester.pumpAndSettle();
      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      fallar = false;
      await tester.tap(find.widgetWithText(OutlinedButton, 'Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('María López'), findsOneWidget);
    });
  });

  group('Marcar como avisado', () {
    testWidgets('pide_una_nota_opcional_registra_el_aviso_y_saca_al_cliente_de_la_lista', (tester) async {
      final api = await abrir(tester);
      await tester.tap(find.byKey(const Key('avisado-ORDEN_LISTA-5')));
      await tester.pumpAndSettle();
      expect(find.text('Nota (opcional)'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('campo-nota-aviso')), 'No contestó');
      await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('POST', '/api/client-notices').single.body, contains('"note":"No contestó"'));
      expect(find.text('María López quedó registrado como avisado.'), findsOneWidget);
      expect(find.text('No hay clientes por avisar'), findsOneWidget);
      expect(insignia('Clientes por avisar'), findsNothing);
    });

    testWidgets('cancelar_no_registra_nada', (tester) async {
      final api = await abrir(tester);
      await tester.tap(find.byKey(const Key('avisado-ORDEN_LISTA-5')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/client-notices'), isEmpty);
      expect(find.text('María López'), findsOneWidget);
    });

    testWidgets('la_nota_se_limita_a_255_caracteres', (tester) async {
      await abrir(tester);
      await tester.tap(find.byKey(const Key('avisado-ORDEN_LISTA-5')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-nota-aviso')), 'x' * 300);
      final campo = tester.widget<TextField>(find.byKey(const Key('campo-nota-aviso')));
      expect(campo.controller!.text.length, 255);
    });

    testWidgets('sin_nota_se_registra_igual', (tester) async {
      final api = await abrir(tester);
      await tester.tap(find.byKey(const Key('avisado-ORDEN_LISTA-5')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/client-notices').single.body, isNot(contains('note')));
    });

    testWidgets('si_el_hecho_ya_no_aplica_muestra_el_mensaje_del_servidor_y_actualiza_la_lista', (tester) async {
      final api = await abrir(tester);
      api.hechoYaNoAplica = true;
      await tester.tap(find.byKey(const Key('avisado-ORDEN_LISTA-5')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
      await tester.pumpAndSettle();
      expect(find.textContaining('ya no aplica'), findsOneWidget);
      expect(api.enviadas('GET', '/api/client-notices').length, greaterThanOrEqualTo(2));
    });
  });
}
