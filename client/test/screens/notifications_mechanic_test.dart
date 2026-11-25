import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api_s6.dart';
import '../helpers/test_app.dart';
import '../helpers/fake_api.dart';

void main() {
  testWidgets('el_mecanico_solo_ve_ordenes_detenidas_en_el_panel', (tester) async {
    final api = ApiAvisos(rol: 'MECHANIC');
    await bombearApp(tester, api.call);
    await entrar(tester);

    expect(tester.widget<Text>(find.byKey(const Key('contador-avisos'))).data, '1');
    await tester.tap(find.byKey(const Key('campana')));
    await tester.pumpAndSettle();

    final panel = find.byKey(const Key('panel-de-avisos'));
    expect(find.descendant(of: panel, matching: find.text('Órdenes detenidas (1)')), findsOneWidget);
    expect(find.descendant(of: panel, matching: find.textContaining('Refacciones')), findsNothing);
    expect(find.descendant(of: panel, matching: find.textContaining('Citas de hoy')), findsNothing);
    expect(find.descendant(of: panel, matching: find.textContaining('Mantenimientos')), findsNothing);
  });

  testWidgets('el_mecanico_no_ve_la_seccion_clientes_por_avisar_ni_insignias', (tester) async {
    final api = ApiAvisos(rol: 'MECHANIC');
    await bombearApp(tester, api.call);
    await entrar(tester);

    expect(find.text('Clientes por avisar'), findsNothing);
    expect(find.byKey(const Key('insignia-Clientes por avisar')), findsNothing);
    expect(find.descendant(of: find.byKey(const Key('insignia-Inventario')), matching: find.byType(Text)), findsNothing);
  });

  testWidgets('el_mecanico_no_pide_la_lista_de_clientes_por_avisar', (tester) async {
    final api = ApiAvisos(rol: 'MECHANIC');
    await bombearApp(tester, api.call);
    await entrar(tester);
    expect(api.enviadas('GET', '/api/client-notices'), isEmpty);
  });
}
