import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/fake_api_s4.dart';
import '../helpers/test_app.dart';

Future<ApiCobros> abrirPanel(WidgetTester tester, {Map<String, dynamic>? panel}) async {
  final api = ApiCobros(
    rol: 'ADMIN',
    panel: panel,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    citas: [citaJson(4, estado: 'CONFIRMADA')],
    ordenes: [ordenJson(7, estado: 'EN_REPARACION')],
    partes: [parteJson(1, 'Sensor de oxígeno', stock: 0, minimo: 2)],
    mantenimientos: [mantenimientoJson(1, clasificacion: 'VENCIDO', dias: -3)],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Panel de control').first);
  await tester.pumpAndSettle();
  return api;
}

void main() {
  group('Tarjetas del panel', () {
    testWidgets('muestra_las_ordenes_por_estado_y_las_que_tienen_saldo_por_cobrar', (tester) async {
      await abrirPanel(tester);
      expect(find.byKey(const Key('ordenes-RECIBIDO')), findsOneWidget);
      expect(tester.widget<Text>(find.byKey(const Key('ordenes-EN_REPARACION'))).data, '2');
      expect(tester.widget<Text>(find.byKey(const Key('ordenes-TERMINADO'))).data, '1');
      expect(tester.widget<Text>(find.byKey(const Key('ordenes-ENTREGADO'))).data, '3');
      expect(tester.widget<Text>(find.byKey(const Key('ordenes-CANCELADA'))).data, '0');
      expect(find.text(r'1 orden con saldo por cobrar · $2,080.00'), findsOneWidget);
    });

    testWidgets('muestra_lo_cobrado_hoy_en_el_mes_y_lo_pendiente_de_cobrar', (tester) async {
      await abrirPanel(tester, panel: panelJson(cobradoHoy: '1750.25', cobradoMes: '6202.50'));
      final tarjeta = find.byKey(const Key('tarjeta-cobros'));
      expect(find.descendant(of: tarjeta, matching: find.text(r'$1,750.25')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text(r'$6,202.50')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text(r'$2,080.00')), findsOneWidget);
      expect(find.text('Cobrado hoy'), findsOneWidget);
      expect(find.text('Cobrado en el mes'), findsOneWidget);
    });

    testWidgets('muestra_las_citas_de_hoy_las_proximas_y_las_siguientes_con_su_detalle', (tester) async {
      await abrirPanel(tester);
      final tarjeta = find.byKey(const Key('tarjeta-citas'));
      expect(find.descendant(of: tarjeta, matching: find.text('Citas de hoy')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('Próximos 7 días')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.textContaining('20/10/2026 10:00 · Roberto Hernández · ABC-123-A')), findsOneWidget);
    });

    testWidgets('muestra_los_mantenimientos_vencidos_y_proximos', (tester) async {
      await abrirPanel(tester, panel: panelJson(vencidos: 4, proximos: 5));
      final tarjeta = find.byKey(const Key('tarjeta-mantenimientos'));
      expect(find.descendant(of: tarjeta, matching: find.text('4')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('5')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('Vencidos')), findsOneWidget);
    });

    testWidgets('muestra_las_alertas_de_inventario_con_las_refacciones_mas_urgentes', (tester) async {
      await abrirPanel(tester);
      final tarjeta = find.byKey(const Key('tarjeta-inventario'));
      expect(find.descendant(of: tarjeta, matching: find.text('Stock bajo')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('Agotadas')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('Sensor de oxígeno (SEN-O2-01)')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('0 de 2')), findsOneWidget);
      expect(find.descendant(of: tarjeta, matching: find.text('Bujía de iridio (BUJ-IR-01)')), findsOneWidget);
    });
  });

  group('Navegación desde las tarjetas', () {
    for (final (llave, texto) in [
      ('tarjeta-ordenes', 'Nueva orden'),
      ('tarjeta-cobros', 'Nueva orden'),
      ('tarjeta-citas', 'Registrar cita'),
      ('tarjeta-mantenimientos', 'Programar mantenimiento'),
      ('tarjeta-inventario', 'Registrar refacción'),
    ]) {
      testWidgets('tocar_${llave}_lleva_a_su_modulo', (tester) async {
        await abrirPanel(tester);
        await tester.tap(find.byKey(Key(llave)));
        await tester.pumpAndSettle();
        expect(find.widgetWithText(FilledButton, texto), findsWidgets);
        expect(find.byKey(const Key('tarjeta-ordenes')), findsNothing);
      });
    }
  });
}
