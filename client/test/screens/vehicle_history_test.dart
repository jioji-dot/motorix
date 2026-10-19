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

Future<ApiInventario> abrirHistorial(
  WidgetTester tester, {
  String rol = 'RECEPTIONIST',
  List<Map<String, dynamic>>? entradas,
}) async {
  final api = ApiInventario(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    historial: {1: entradas ?? []},
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Vehículos').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('ABC-123-A'));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('boton-historial')));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  group('Historial del vehículo', () {
    testWidgets('muestra_los_servicios_del_mas_reciente_al_mas_antiguo_con_su_detalle', (tester) async {
      await abrirHistorial(tester, entradas: [
        historialJson(
          12,
          fecha: '2026-10-05T16:30:00.000',
          km: 48200,
          servicios: [servicioJson(1, 'Banda de accesorios nueva', '680.00')],
          manoDeObra: [manoDeObraJson(1, 'Cambio de banda', '1.50', '350.00', '525.00')],
          refacciones: [refaccionDeOrdenJson(1, 3, 'Filtro de aceite', 2, '110.00')],
          total: '1425.00',
        ),
        historialJson(8, estado: 'TERMINADO', fecha: '2026-03-02T10:00:00.000', km: 40100, recomendaciones: null, total: '500.00'),
      ]);

      expect(find.text('Historial · Nissan Versa 2020 · ABC-123-A'), findsOneWidget);
      expect(find.text('05/10/2026 · OS-000012'), findsOneWidget);
      expect(find.text('02/03/2026 · OS-000008'), findsOneWidget);
      // El más reciente aparece primero.
      expect(tester.getTopLeft(find.byKey(const Key('servicio-12'))).dy, lessThan(tester.getTopLeft(find.byKey(const Key('servicio-8'))).dy));
      expect(find.textContaining('48,200 km'), findsOneWidget);
      expect(find.text('Banda de accesorios nueva'), findsOneWidget);
      expect(find.text('Cambio de banda'), findsOneWidget);
      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.text('Revisar el alternador en el próximo servicio.'), findsOneWidget);
      expect(find.text(r'$1,425.00'), findsOneWidget);
    });

    for (final rol in ['ADMIN', 'MECHANIC', 'RECEPTIONIST']) {
      testWidgets('el_rol_${rol}_puede_abrir_el_historial', (tester) async {
        await abrirHistorial(tester, rol: rol, entradas: [historialJson(12)]);
        expect(find.byKey(const Key('servicio-12')), findsOneWidget);
      });
    }

    testWidgets('sin_servicios_muestra_el_estado_vacio', (tester) async {
      await abrirHistorial(tester);
      expect(find.text('Sin servicios registrados'), findsOneWidget);
    });

    testWidgets('si_falla_la_carga_muestra_el_error_en_espanol_con_reintentar', (tester) async {
      final api = ApiInventario(
        rol: 'RECEPTIONIST',
        clientes: [clienteJson(1, 'Roberto Hernández')],
        vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
      );
      api.sobrescribir = (p) => p.url.path.endsWith('/history')
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Vehículos').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('ABC-123-A'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('boton-historial')));
      await tester.pumpAndSettle();

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Reintentar'), findsOneWidget);
    });
  });

  group('Kilometraje del servicio en la orden', () {
    Future<ApiInventario> abrirOrden(WidgetTester tester, {String rol = 'MECHANIC', int mechanicId = 1, String estado = 'EN_REPARACION'}) async {
      final orden = ordenJson(7, estado: estado, mechanicId: mechanicId);
      final api = ApiInventario(
        rol: rol,
        clientes: [clienteJson(1, 'Roberto Hernández')],
        vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
        ordenes: [orden],
      );
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.byTooltip('Órdenes de servicio').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('OS-000007'));
      await tester.pumpAndSettle();
      return api;
    }

    testWidgets('el_detalle_dice_que_no_esta_registrado_cuando_falta', (tester) async {
      await abrirOrden(tester);
      expect(find.text('Kilometraje del servicio'), findsOneWidget);
      expect(find.text('No registrado'), findsOneWidget);
    });

    testWidgets('el_mecanico_asignado_lo_registra_y_se_muestra_en_el_detalle', (tester) async {
      final api = await abrirOrden(tester);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Editar trabajo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-km-servicio')), '45300');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('PATCH', '/api/orders/7').single.body) as Map<String, dynamic>;
      expect(envio, containsPair('serviceMileage', 45300));
      expect(find.text('45,300 km'), findsOneWidget);
    });

    testWidgets('un_kilometraje_menor_al_de_entrada_muestra_el_error_y_bloquea_guardar', (tester) async {
      final api = await abrirOrden(tester);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Editar trabajo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-km-servicio')), '100');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('No puede ser menor al kilometraje de entrada'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Guardar')).onPressed, isNull);
      expect(api.enviadas('PATCH', '/api/orders/7'), isEmpty);
    });

    testWidgets('recepcion_y_otro_mecanico_no_pueden_editarlo', (tester) async {
      await abrirOrden(tester, rol: 'RECEPTIONIST');
      expect(find.widgetWithText(OutlinedButton, 'Editar trabajo'), findsNothing);
    });

    testWidgets('una_orden_terminada_es_de_solo_lectura', (tester) async {
      await abrirOrden(tester, estado: 'TERMINADO');
      expect(find.widgetWithText(OutlinedButton, 'Editar trabajo'), findsNothing);
    });
  });
}
