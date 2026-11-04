// Las pantallas del mecánico no muestran precios ni totales de refacciones (Sprint 5, FR-008), sin dejar
// marcadores de posición; recepción y administración sí los ven.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/test_app.dart';

// El usuario de la API simulada tiene siempre id 1: una orden con mechanicId 1 está asignada a la sesión.
ApiInventario crearApi(String rol) {
  final orden = ordenJson(7, estado: 'EN_REPARACION', mechanicId: 1);
  orden['parts'] = [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')];
  return ApiInventario(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [orden],
    partes: [parteJson(1, 'Filtro de aceite', stock: 10, minimo: 3, precioVenta: '110.00')],
    historial: {
      1: [
        historialJson(
          12,
          servicios: [servicioJson(1, 'Banda de accesorios nueva', '680.00')],
          refacciones: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite', 2, '110.00')],
          total: '900.00',
        ),
      ],
    },
  );
}

Future<void> iniciar(WidgetTester tester, String rol) async {
  final api = crearApi(rol);
  await bombearApp(tester, api.call);
  await entrar(tester);
}

Future<void> abrirOrden(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
}

void main() {
  group('Listado y detalle de órdenes', () {
    testWidgets('el_mecanico_no_ve_la_columna_del_total_en_el_listado', (tester) async {
      await iniciar(tester, 'MECHANIC');
      await abrirOrden(tester);
      expect(find.text('OS-000007'), findsOneWidget);
      expect(find.text('Total'), findsNothing);
    });

    testWidgets('recepcion_si_ve_la_columna_del_total_en_el_listado', (tester) async {
      await iniciar(tester, 'RECEPTIONIST');
      await abrirOrden(tester);
      expect(find.text('Total'), findsOneWidget);
    });

    testWidgets('el_mecanico_ve_las_refacciones_de_la_orden_sin_precio_importe_ni_total', (tester) async {
      await iniciar(tester, 'MECHANIC');
      await abrirOrden(tester);
      await tester.tap(find.text('OS-000007'));
      await tester.pumpAndSettle();

      expect(find.text('Refacciones utilizadas'), findsOneWidget);
      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.textContaining('2 ×'), findsNothing);
      expect(find.text(r'$220.00'), findsNothing);
      expect(find.text(r'$110.00'), findsNothing);
      expect(find.textContaining('Total'), findsNothing);
      // Sin marcadores de posición: nada que parezca un importe donde no hay uno.
      expect(find.text(r'$0.00'), findsNothing);
      expect(find.text('null'), findsNothing);
    });

    testWidgets('recepcion_ve_precio_importe_y_total_de_las_refacciones_de_la_orden', (tester) async {
      await iniciar(tester, 'RECEPTIONIST');
      await abrirOrden(tester);
      await tester.tap(find.text('OS-000007'));
      await tester.pumpAndSettle();

      expect(find.text('2 × \$110.00'), findsOneWidget);
      expect(find.text(r'$220.00'), findsWidgets);
      expect(find.textContaining('Total'), findsWidgets);
    });
  });

  group('Inventario', () {
    testWidgets('el_mecanico_no_ve_la_columna_de_precio_de_venta_en_el_inventario', (tester) async {
      await iniciar(tester, 'MECHANIC');
      await tester.tap(find.text('Inventario').first);
      await tester.pumpAndSettle();
      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.text('Precio de venta'), findsNothing);
      expect(find.text(r'$110.00'), findsNothing);
    });

    testWidgets('el_mecanico_no_ve_el_precio_de_venta_en_el_detalle_de_la_refaccion', (tester) async {
      await iniciar(tester, 'MECHANIC');
      await tester.tap(find.text('Inventario').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Filtro de aceite'));
      await tester.pumpAndSettle();
      expect(find.text('Precio de venta'), findsNothing);
      expect(find.text(r'$110.00'), findsNothing);
    });

    testWidgets('el_selector_de_refacciones_del_mecanico_muestra_codigo_y_stock_sin_precio', (tester) async {
      await iniciar(tester, 'MECHANIC');
      await abrirOrden(tester);
      await tester.tap(find.text('OS-000007'));
      await tester.pumpAndSettle();
      final agregar = find.byKey(const Key('boton-agregar-refaccion'));
      await tester.ensureVisible(agregar);
      await tester.pumpAndSettle();
      await tester.tap(agregar);
      await tester.pumpAndSettle();

      expect(find.textContaining('Stock: 10'), findsOneWidget);
      expect(find.textContaining(r'$110.00'), findsNothing);
      expect(find.textContaining(' · \$'), findsNothing);
    });

    testWidgets('recepcion_si_ve_el_precio_de_venta_en_el_inventario', (tester) async {
      await iniciar(tester, 'RECEPTIONIST');
      await tester.tap(find.text('Inventario').first);
      await tester.pumpAndSettle();
      expect(find.text('Precio de venta'), findsOneWidget);
      expect(find.text(r'$110.00'), findsOneWidget);
    });
  });

  group('Historial del vehículo', () {
    Future<void> abrirHistorial(WidgetTester tester) async {
      await tester.tap(find.text('Vehículos').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('ABC-123-A'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('boton-historial')));
      await tester.pumpAndSettle();
    }

    testWidgets('el_mecanico_ve_el_servicio_con_sus_importes_de_servicios_pero_sin_total_ni_precios_de_refacciones', (tester) async {
      await iniciar(tester, 'MECHANIC');
      await abrirHistorial(tester);
      expect(find.text('Banda de accesorios nueva'), findsOneWidget);
      expect(find.text(r'$680.00'), findsWidgets);
      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.textContaining('2 ×'), findsNothing);
      expect(find.text(r'$900.00'), findsNothing);
      expect(find.textContaining('Total'), findsNothing);
    });

    testWidgets('recepcion_ve_el_total_y_los_precios_de_las_refacciones_en_el_historial', (tester) async {
      await iniciar(tester, 'RECEPTIONIST');
      await abrirHistorial(tester);
      expect(find.text(r'$900.00'), findsOneWidget);
      expect(find.text('2 × \$110.00'), findsOneWidget);
    });
  });
}
