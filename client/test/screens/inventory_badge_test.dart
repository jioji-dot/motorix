import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api_s3.dart';
import '../helpers/fake_api_s6.dart';
import '../helpers/test_app.dart';
import '../helpers/fake_api.dart';

Finder insignia(String seccion) => find.descendant(of: find.byKey(Key('insignia-$seccion')), matching: find.byType(Text));

Future<ApiAvisos> abrir(WidgetTester tester, String rol, {List<Map<String, dynamic>>? grupos}) async {
  final api = ApiAvisos(rol: rol, grupos: grupos, partes: [parteJson(1, 'Filtro de aceite', stock: 25, minimo: 8), parteJson(5, 'Sensor de oxígeno', stock: 0, minimo: 2)]);
  await bombearApp(tester, api.call);
  await entrar(tester);
  return api;
}

void main() {
  testWidgets('el_administrador_ve_la_insignia_de_inventario_con_las_alertas_de_stock', (tester) async {
    await abrir(tester, 'ADMIN');
    expect(insignia('Inventario'), findsOneWidget);
    expect(tester.widget<Text>(insignia('Inventario')).data, '1');
  });

  for (final rol in ['RECEPTIONIST', 'MECHANIC']) {
    testWidgets('el_rol_${rol}_no_ve_insignia_en_inventario', (tester) async {
      await abrir(tester, rol);
      expect(find.byKey(const Key('insignia-Inventario')), findsOneWidget); // la sección existe
      expect(insignia('Inventario'), findsNothing); // pero sin número
    });
  }

  testWidgets('sin_alertas_no_se_muestra_la_insignia', (tester) async {
    await abrir(tester, 'ADMIN', grupos: []);
    expect(insignia('Inventario'), findsNothing);
  });

  testWidgets('la_insignia_y_el_resumen_de_inventario_coexisten', (tester) async {
    await abrir(tester, 'ADMIN');
    await tester.tap(find.text('Inventario').first);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('resumen-de-alertas')), findsOneWidget);
    expect(tester.widget<Text>(insignia('Inventario')).data, '1');
  });
}
