import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/test_app.dart';

Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

// El usuario de la API simulada tiene siempre id 1: una orden con mechanicId 1 está "asignada" al mecánico de la sesión.
Future<ApiInventario> abrirOrden(
  WidgetTester tester, {
  String rol = 'MECHANIC',
  String estado = 'EN_REPARACION',
  int mechanicId = 1,
  List<Map<String, dynamic>>? partes,
  List<Map<String, dynamic>>? refaccionesUsadas,
}) async {
  final orden = ordenJson(7, estado: estado, mechanicId: mechanicId);
  orden['parts'] = refaccionesUsadas ?? <Map<String, dynamic>>[];
  orden['total'] = (refaccionesUsadas ?? const []).fold<double>(0, (suma, r) => suma + double.parse(r['amount'] as String)).toStringAsFixed(2);
  final api = ApiInventario(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [orden],
    partes: partes ??
        [
          parteJson(1, 'Filtro de aceite', stock: 10, minimo: 3, precioVenta: '110.00'),
          parteJson(2, 'Disco de freno', stock: 3, minimo: 3, precioVenta: '1250.00'),
          parteJson(3, 'Sensor de oxígeno', stock: 0, minimo: 2),
        ],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  return api;
}

Future<void> abrirSelector(WidgetTester tester) async {
  await tocarVisible(tester, find.byKey(const Key('boton-agregar-refaccion')));
  await tester.pumpAndSettle();
}

void main() {
  group('Bloque de refacciones de la orden', () {
    testWidgets('muestra_las_refacciones_usadas_con_precio_importe_y_total', (tester) async {
      await abrirOrden(tester, refaccionesUsadas: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')]);

      expect(find.text('Refacciones utilizadas'), findsOneWidget);
      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.text('2 × \$110.00'), findsOneWidget);
      expect(find.text(r'$220.00'), findsWidgets);
    });

    testWidgets('sin_refacciones_dice_que_no_hay_registradas', (tester) async {
      await abrirOrden(tester);
      expect(find.text('Sin refacciones registradas'), findsOneWidget);
    });

    testWidgets('el_mecanico_asignado_y_el_administrador_pueden_agregar', (tester) async {
      await abrirOrden(tester);
      expect(find.byKey(const Key('boton-agregar-refaccion')), findsOneWidget);
    });

    testWidgets('recepcion_y_otro_mecanico_no_ven_las_acciones', (tester) async {
      await abrirOrden(tester, rol: 'RECEPTIONIST');
      expect(find.byKey(const Key('boton-agregar-refaccion')), findsNothing);
    });

    for (final estado in ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      testWidgets('la_orden_${estado}_muestra_las_refacciones_solo_en_lectura', (tester) async {
        await abrirOrden(tester, estado: estado, refaccionesUsadas: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')]);
        expect(find.text('Filtro de aceite'), findsOneWidget);
        expect(find.byKey(const Key('boton-agregar-refaccion')), findsNothing);
        expect(find.byTooltip('Quitar refacción'), findsNothing);
        expect(find.byTooltip('Cambiar cantidad'), findsNothing);
      });
    }
  });

  group('Selector de refacción', () {
    testWidgets('busca_y_agrega_la_refaccion_con_la_cantidad_y_actualiza_el_total', (tester) async {
      final api = await abrirOrden(tester);
      await abrirSelector(tester);

      expect(find.text('Filtro de aceite'), findsOneWidget);
      await tester.tap(find.byKey(const Key('refaccion-1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-cantidad')), '2');
      await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('POST', '/api/orders/7/parts').single.body) as Map<String, dynamic>;
      expect(envio, {'partId': 1, 'quantity': 2});
      expect(find.text('Refacción agregada.'), findsOneWidget);
      expect(find.text('2 × \$110.00'), findsOneWidget);
      expect(find.text(r'$220.00'), findsWidgets);
    });

    testWidgets('advierte_si_el_stock_es_bajo_y_limita_la_cantidad_al_disponible', (tester) async {
      final api = await abrirOrden(tester);
      await abrirSelector(tester);

      await tester.tap(find.byKey(const Key('refaccion-2')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('advertencia-stock')), findsOneWidget);
      expect(find.text('Stock bajo: quedan 3 piezas.'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('campo-cantidad')), '4');
      await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
      await tester.pumpAndSettle();

      expect(find.text('Solo hay 3 piezas disponibles.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/orders/7/parts'), isEmpty);
    });

    testWidgets('una_refaccion_agotada_aparece_marcada_y_no_se_puede_elegir', (tester) async {
      await abrirOrden(tester);
      await abrirSelector(tester);

      expect(find.text('Agotada'), findsOneWidget);
      await tester.tap(find.byKey(const Key('refaccion-3')), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Agregar')).onPressed, isNull);
    });

    testWidgets('la_cantidad_debe_ser_un_entero_mayor_a_cero', (tester) async {
      final api = await abrirOrden(tester);
      await abrirSelector(tester);

      await tester.tap(find.byKey(const Key('refaccion-1')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-cantidad')), '0');
      await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
      await tester.pumpAndSettle();

      expect(find.text('La cantidad debe ser un número entero mayor a 0.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/orders/7/parts'), isEmpty);
    });

    testWidgets('si_el_servidor_rechaza_por_stock_insuficiente_muestra_su_mensaje', (tester) async {
      final api = await abrirOrden(tester);
      api.sobrescribir = (p) => (p.method == 'POST' && p.url.path == '/api/orders/7/parts')
          ? jsonResponse(409, {
              'error': {'code': 'INSUFFICIENT_STOCK', 'message': 'No hay existencias suficientes de "Filtro de aceite". Stock disponible: 1.', 'available': 1},
            })
          : null;
      await abrirSelector(tester);

      await tester.tap(find.byKey(const Key('refaccion-1')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Agregar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('No hay existencias suficientes de "Filtro de aceite"'), findsOneWidget);
    });

    testWidgets('buscar_envia_el_texto_y_solo_pide_refacciones_activas', (tester) async {
      final api = await abrirOrden(tester);
      await abrirSelector(tester);

      await tester.enterText(find.byKey(const Key('buscar-refaccion')), 'disco');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      final busqueda = api.peticiones.where((p) => p.url.path == '/api/parts' && p.url.queryParameters['search'] == 'disco');
      expect(busqueda, isNotEmpty);
      expect(busqueda.first.url.queryParameters['active'], 'true');
      expect(find.byKey(const Key('refaccion-1')), findsNothing);
      expect(find.byKey(const Key('refaccion-2')), findsOneWidget);
    });
  });

  group('Cambiar y quitar refacciones', () {
    testWidgets('cambiar_la_cantidad_envia_la_nueva_y_actualiza_el_total', (tester) async {
      final api = await abrirOrden(tester, refaccionesUsadas: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')]);

      await tocarVisible(tester, find.byTooltip('Cambiar cantidad'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-cantidad')), '4');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(jsonDecode(api.enviadas('PATCH', '/api/orders/7/parts/1').single.body), {'quantity': 4});
      expect(find.text('4 × \$110.00'), findsOneWidget);
    });

    testWidgets('quitar_pide_confirmacion_y_regresa_las_piezas', (tester) async {
      final api = await abrirOrden(tester, refaccionesUsadas: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')]);

      await tocarVisible(tester, find.byTooltip('Quitar refacción'));
      await tester.pumpAndSettle();
      expect(find.text('Quitar refacción'), findsWidgets);
      expect(find.textContaining('Las piezas regresarán al inventario'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('DELETE', '/api/orders/7/parts/1'), hasLength(1));
      expect(find.text('Refacción quitada.'), findsOneWidget);
      expect(find.text('Sin refacciones registradas'), findsOneWidget);
    });

    testWidgets('cancelar_la_confirmacion_no_quita_nada', (tester) async {
      final api = await abrirOrden(tester, refaccionesUsadas: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')]);

      await tocarVisible(tester, find.byTooltip('Quitar refacción'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('DELETE', '/api/orders/7/parts/1'), isEmpty);
      expect(find.text('Filtro de aceite'), findsOneWidget);
    });
  });
}
