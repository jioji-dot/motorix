import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/test_app.dart';

Future<void> irAOrdenes(WidgetTester tester) async {
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
}

ApiTaller apiConOrdenes({String rol = 'RECEPTIONIST', List<Map<String, dynamic>>? ordenes}) => ApiTaller(
      rol: rol,
      clientes: [clienteJson(1, 'Roberto Hernández'), clienteJson(2, 'María López', telefono: '5598765432')],
      vehiculos: [vehiculoJson(1, 1, 'ABC-123-A'), vehiculoJson(2, 2, 'DEF-456-B', propietario: 'María López')],
      ordenes: ordenes,
    );

void main() {
  group('Lista de órdenes', () {
    testWidgets('muestra_folio_cliente_placas_mecanico_estado_y_total', (tester) async {
      final api = apiConOrdenes(ordenes: [
        ordenJson(1, estado: 'EN_REPARACION'),
        ordenJson(2, estado: 'RECIBIDO', clientId: 2, vehicleId: 2, cliente: 'María López', placas: 'DEF-456-B', mecanico: 'Ana Mecánica', mechanicId: 4),
      ]);
      api.ordenes[0]['total'] = '2600.50';
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      expect(find.text('OS-000001'), findsOneWidget);
      expect(find.text('OS-000002'), findsOneWidget);
      expect(find.text('María López'), findsOneWidget);
      expect(find.text('DEF-456-B'), findsOneWidget);
      expect(find.text('Ana Mecánica'), findsOneWidget);
      expect(find.text('En reparación'), findsWidgets);
      expect(find.text('Recibido'), findsWidgets);
      expect(find.text('\$2,600.50'), findsOneWidget);
    });

    testWidgets('el_mecanico_sin_ordenes_ve_un_estado_vacio_que_lo_explica', (tester) async {
      await bombearApp(tester, apiConOrdenes(rol: 'MECHANIC').call);
      await irAOrdenes(tester);

      expect(find.text('No tienes órdenes asignadas'), findsOneWidget);
      expect(find.text('Nueva orden'), findsNothing);
    });

    testWidgets('recepcion_sin_ordenes_ve_el_estado_vacio_con_la_accion_de_crear', (tester) async {
      await bombearApp(tester, apiConOrdenes().call);
      await irAOrdenes(tester);

      expect(find.text('Aún no hay órdenes de servicio'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Nueva orden'), findsWidgets);
    });

    testWidgets('el_mecanico_ve_las_ordenes_pero_no_el_boton_de_nueva_orden', (tester) async {
      final api = apiConOrdenes(rol: 'MECHANIC', ordenes: [ordenJson(1)]);
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      expect(find.text('OS-000001'), findsOneWidget);
      expect(find.text('Nueva orden'), findsNothing);
    });

    testWidgets('el_filtro_de_estado_y_la_busqueda_se_envian_a_la_api', (tester) async {
      final api = apiConOrdenes(ordenes: [ordenJson(1), ordenJson(2, estado: 'TERMINADO')]);
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      await tester.tap(find.byKey(const Key('filtro-estado-orden')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Terminado').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'OS-0000');
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pumpAndSettle();

      final consultas = api.enviadas('GET', '/api/orders').map((p) => p.url.queryParameters);
      expect(consultas.any((q) => q['status'] == 'TERMINADO'), isTrue);
      expect(consultas.any((q) => q['search'] == 'OS-0000'), isTrue);
    });

    testWidgets('muestra_el_error_de_la_api_con_reintentar', (tester) async {
      final api = apiConOrdenes();
      api.sobrescribir = (p) => p.url.path == '/api/orders' && p.method == 'GET'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('nueva_orden_abre_el_formulario', (tester) async {
      await bombearApp(tester, apiConOrdenes().call);
      await irAOrdenes(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Nueva orden').first);
      await tester.pumpAndSettle();

      expect(find.text('Nueva orden de servicio'), findsOneWidget);
    });
  });

  group('Detalle de la orden', () {
    Map<String, dynamic> ordenCompleta() {
      final orden = ordenJson(
        7,
        estado: 'EN_REPARACION',
        diagnostico: 'Falla en la bomba de agua',
        servicios: [servicioJson(1, 'Cambio de bomba de agua', '1850.50')],
        manoDeObra: [manoDeObraJson(1, 'Desmontaje y montaje', '2.50', '300.00', '750.00')],
      );
      orden['total'] = '2600.50';
      orden['notes'] = 'Se encontró corrosión en las mangueras.';
      orden['recommendations'] = 'Cambiar mangueras en el próximo servicio.';
      return orden;
    }

    testWidgets('muestra_los_datos_el_trabajo_el_total_y_el_historial', (tester) async {
      final api = apiConOrdenes(ordenes: [ordenCompleta()]);
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      await tester.tap(find.text('OS-000007'));
      await tester.pumpAndSettle();

      expect(find.text('Falla en la bomba de agua'), findsOneWidget);
      expect(find.text('Ruido en el motor'), findsOneWidget);
      expect(find.text('Cambio de bomba de agua'), findsOneWidget);
      expect(find.text('Desmontaje y montaje'), findsOneWidget);
      expect(find.text('\$1,850.50'), findsOneWidget);
      expect(find.text('\$750.00'), findsOneWidget);
      expect(find.text('\$2,600.50'), findsWidgets);
      expect(find.text('Se encontró corrosión en las mangueras.'), findsOneWidget);
      expect(find.text('Cambiar mangueras en el próximo servicio.'), findsOneWidget);
      expect(find.textContaining('Rosa Recepción'), findsOneWidget); // historial
      expect(find.text('Mario Mecánico'), findsWidgets);
    });

    testWidgets('sin_diagnostico_ni_lineas_muestra_textos_que_lo_indican', (tester) async {
      final api = apiConOrdenes(ordenes: [ordenJson(8)]);
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      await tester.tap(find.text('OS-000008'));
      await tester.pumpAndSettle();

      expect(find.text('Sin diagnóstico registrado'), findsOneWidget);
      expect(find.text('Sin servicios registrados'), findsOneWidget);
      expect(find.text('Sin mano de obra registrada'), findsOneWidget);
    });

    testWidgets('muestra_el_motivo_cuando_la_orden_esta_cancelada', (tester) async {
      final orden = ordenJson(9, estado: 'CANCELADA');
      orden['cancellationReason'] = 'El cliente se llevó el vehículo';
      final api = apiConOrdenes(ordenes: [orden]);
      await bombearApp(tester, api.call);
      await irAOrdenes(tester);

      await tester.tap(find.text('OS-000009'));
      await tester.pumpAndSettle();

      expect(find.textContaining('El cliente se llevó el vehículo'), findsOneWidget);
    });
  });
}
