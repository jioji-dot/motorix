import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/test_app.dart';

Future<ApiInventario> abrirInventario(WidgetTester tester, List<Map<String, dynamic>> partes, {String rol = 'MECHANIC'}) async {
  final api = ApiInventario(rol: rol, partes: partes);
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Inventario').first);
  await tester.pumpAndSettle();
  return api;
}

void main() {
  final enOrden = parteJson(1, 'Filtro de aceite', stock: 25, minimo: 8);
  final enElLimite = parteJson(2, 'Disco de freno', stock: 4, minimo: 4);
  final agotada = parteJson(3, 'Sensor de oxígeno', stock: 0, minimo: 2);

  group('Alertas de stock bajo', () {
    testWidgets('el_resumen_cuenta_las_refacciones_con_stock_bajo_y_agotadas', (tester) async {
      await abrirInventario(tester, [enOrden, enElLimite, agotada]);

      final resumen = find.byKey(const Key('resumen-de-alertas'));
      expect(resumen, findsOneWidget);
      expect(find.descendant(of: resumen, matching: find.text('1 con stock bajo · 1 agotada')), findsOneWidget);
    });

    testWidgets('las_filas_muestran_la_marca_de_cada_nivel_incluido_el_limite_exacto', (tester) async {
      await abrirInventario(tester, [enOrden, enElLimite, agotada]);

      expect(find.text('En orden'), findsOneWidget);
      expect(find.text('Stock bajo'), findsWidgets);
      expect(find.text('Agotada'), findsOneWidget);
    });

    testWidgets('sin_alertas_el_resumen_dice_que_todo_el_stock_esta_en_orden', (tester) async {
      await abrirInventario(tester, [enOrden]);

      expect(find.text('Todo el stock está en orden'), findsOneWidget);
    });

    testWidgets('el_filtro_stock_bajo_pide_al_servidor_solo_las_alertas', (tester) async {
      final api = await abrirInventario(tester, [enOrden, enElLimite, agotada]);

      await tester.tap(find.byKey(const Key('filtro-stock-bajo')));
      await tester.pumpAndSettle();

      expect(api.peticiones.any((p) => p.url.path == '/api/parts' && p.url.queryParameters['stockLevel'] == 'LOW,OUT'), isTrue);
      expect(find.text('Filtro de aceite'), findsNothing);
      expect(find.text('Disco de freno'), findsOneWidget);
      expect(find.text('Sensor de oxígeno'), findsOneWidget);

      await tester.tap(find.byKey(const Key('filtro-stock-bajo')));
      await tester.pumpAndSettle();
      expect(find.text('Filtro de aceite'), findsOneWidget);
    });

    testWidgets('el_filtro_sin_resultados_muestra_el_estado_vacio_filtrado', (tester) async {
      await abrirInventario(tester, [enOrden]);

      await tester.tap(find.byKey(const Key('filtro-stock-bajo')));
      await tester.pumpAndSettle();

      expect(find.text('No se encontraron refacciones'), findsOneWidget);
    });

    testWidgets('al_registrar_una_entrada_que_supera_el_minimo_la_alerta_desaparece', (tester) async {
      await abrirInventario(
        tester,
        [parteJson(2, 'Disco de freno', stock: 4, minimo: 4)],
        rol: 'ADMIN',
      );
      expect(find.text('1 con stock bajo · 0 agotadas'), findsOneWidget);

      await tester.tap(find.text('Disco de freno'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('boton-registrar-movimiento')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-cantidad')), '10');
      await tester.enterText(find.byKey(const Key('campo-motivo')), 'Compra a proveedor');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();

      expect(find.text('Todo el stock está en orden'), findsOneWidget);
    });
  });
}
