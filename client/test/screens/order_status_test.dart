import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/test_app.dart';

Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

Future<ApiTaller> abrirOrden(WidgetTester tester, {required String rol, String estado = 'RECIBIDO'}) async {
  final api = ApiTaller(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [ordenJson(7, estado: estado, mechanicId: 1)],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  return api;
}

Map<String, dynamic> cuerpoDelUltimoCambio(ApiTaller api) =>
    jsonDecode(api.enviadas('POST', '/api/orders/7/status').last.body) as Map<String, dynamic>;

void main() {
  group('Acciones según el rol y el estado', () {
    testWidgets('el_mecanico_ve_solo_los_avances_del_trabajo', (tester) async {
      await abrirOrden(tester, rol: 'MECHANIC', estado: 'EN_REPARACION');

      expect(find.widgetWithText(FilledButton, 'Marcar como terminada'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Esperar refacción'), findsOneWidget);
      expect(find.text('Cancelar orden'), findsNothing);
      expect(find.text('Entregar vehículo'), findsNothing);
    });

    testWidgets('recepcion_ve_cancelar_pero_no_los_avances_del_trabajo', (tester) async {
      await abrirOrden(tester, rol: 'RECEPTIONIST', estado: 'EN_REPARACION');

      expect(find.widgetWithText(OutlinedButton, 'Cancelar orden'), findsOneWidget);
      expect(find.text('Marcar como terminada'), findsNothing);
      expect(find.text('Esperar refacción'), findsNothing);
    });

    testWidgets('recepcion_ve_entregar_cuando_la_orden_esta_terminada', (tester) async {
      await abrirOrden(tester, rol: 'RECEPTIONIST', estado: 'TERMINADO');

      expect(find.widgetWithText(FilledButton, 'Entregar vehículo'), findsOneWidget);
      expect(find.text('Cancelar orden'), findsNothing);
    });

    testWidgets('el_mecanico_no_ve_acciones_en_una_orden_terminada', (tester) async {
      await abrirOrden(tester, rol: 'MECHANIC', estado: 'TERMINADO');
      expect(find.byKey(const Key('acciones-de-estado')), findsNothing);
    });

    for (final estado in ['ENTREGADO', 'CANCELADA']) {
      testWidgets('la_orden_${estado}_no_ofrece_ninguna_accion_de_estado', (tester) async {
        await abrirOrden(tester, rol: 'ADMIN', estado: estado);
        expect(find.byKey(const Key('acciones-de-estado')), findsNothing);
      });
    }

    testWidgets('desde_esperando_refaccion_el_boton_se_llama_reanudar_reparacion', (tester) async {
      await abrirOrden(tester, rol: 'MECHANIC', estado: 'ESPERANDO_REFACCION');
      expect(find.widgetWithText(FilledButton, 'Reanudar reparación'), findsOneWidget);
    });
  });

  group('Avanzar el trabajo', () {
    testWidgets('el_mecanico_inicia_el_diagnostico_y_se_actualizan_el_estado_y_el_historial', (tester) async {
      final api = await abrirOrden(tester, rol: 'MECHANIC');

      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar diagnóstico'));
      await tester.pumpAndSettle();

      expect(cuerpoDelUltimoCambio(api), {'status': 'DIAGNOSTICO', 'expectedStatus': 'RECIBIDO'});
      expect(find.text('Estado actualizado: Diagnóstico.'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Iniciar reparación'), findsOneWidget); // siguiente paso disponible
      expect(find.widgetWithText(FilledButton, 'Iniciar diagnóstico'), findsNothing);
      expect(find.text('Diagnóstico'), findsWidgets); // chip y entrada del historial
    });

    testWidgets('si_falta_diagnostico_o_servicios_muestra_el_mensaje_de_la_api', (tester) async {
      final api = await abrirOrden(tester, rol: 'MECHANIC', estado: 'EN_REPARACION');
      api.sobrescribir = (p) => p.method == 'POST' && p.url.path == '/api/orders/7/status'
          ? jsonResponse(409, {
              'error': {
                'code': 'ORDER_INCOMPLETE',
                'message': 'Para terminar la orden falta registrar el diagnóstico y al menos un servicio o mano de obra.',
              },
            })
          : null;

      await tester.tap(find.widgetWithText(FilledButton, 'Marcar como terminada'));
      await tester.pumpAndSettle();

      expect(find.textContaining('falta registrar el diagnóstico'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Marcar como terminada'), findsOneWidget); // sigue en el mismo estado
    });
  });

  group('Entregar', () {
    testWidgets('pide_confirmacion_y_solo_entonces_entrega', (tester) async {
      final api = await abrirOrden(tester, rol: 'RECEPTIONIST', estado: 'TERMINADO');

      await tester.tap(find.widgetWithText(FilledButton, 'Entregar vehículo'));
      await tester.pumpAndSettle();
      expect(find.text('Confirmar'), findsOneWidget);
      expect(find.text('Cancelar'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/orders/7/status'), isEmpty);

      await tester.tap(find.widgetWithText(FilledButton, 'Entregar vehículo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(cuerpoDelUltimoCambio(api), {'status': 'ENTREGADO', 'expectedStatus': 'TERMINADO'});
      expect(find.text('Estado actualizado: Entregado.'), findsOneWidget);
      expect(find.byKey(const Key('acciones-de-estado')), findsNothing); // ya no hay acciones
    });
  });

  group('Cancelar la orden', () {
    testWidgets('exige_un_motivo_y_lo_envia_a_la_api', (tester) async {
      final api = await abrirOrden(tester, rol: 'RECEPTIONIST', estado: 'DIAGNOSTICO');

      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar orden'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();
      expect(find.text('Indica el motivo de la cancelación.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/orders/7/status'), isEmpty);

      await tester.enterText(find.byKey(const Key('campo-motivo-cancelacion')), 'El cliente se llevó el vehículo');
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(cuerpoDelUltimoCambio(api), {
        'status': 'CANCELADA',
        'reason': 'El cliente se llevó el vehículo',
        'expectedStatus': 'DIAGNOSTICO',
      });
      expect(find.text('Estado actualizado: Cancelada.'), findsOneWidget);
      expect(find.textContaining('El cliente se llevó el vehículo'), findsWidgets);
    });

    testWidgets('cancelar_el_dialogo_no_modifica_la_orden', (tester) async {
      final api = await abrirOrden(tester, rol: 'ADMIN', estado: 'RECIBIDO');

      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar orden'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar').last);
      await tester.pumpAndSettle();

      expect(api.enviadas('POST', '/api/orders/7/status'), isEmpty);
    });
  });

  group('Cambios simultáneos', () {
    testWidgets('ante_STATE_CONFLICT_avisa_y_recarga_la_orden', (tester) async {
      final api = await abrirOrden(tester, rol: 'MECHANIC');
      api.sobrescribir = (p) => p.method == 'POST' && p.url.path == '/api/orders/7/status'
          ? jsonResponse(409, {
              'error': {
                'code': 'STATE_CONFLICT',
                'message': 'La orden cambió de estado mientras la revisabas. Recarga la pantalla para ver su estado actual.',
              },
            })
          : null;
      final consultasAntes = api.enviadas('GET', '/api/orders/7').length;

      await tester.tap(find.widgetWithText(FilledButton, 'Iniciar diagnóstico'));
      await tester.pumpAndSettle();

      expect(find.textContaining('La orden cambió de estado'), findsOneWidget);
      expect(api.enviadas('GET', '/api/orders/7').length, consultasAntes + 1); // se recargó sola
    });
  });
}
