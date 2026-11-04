import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/fake_api_s5.dart';
import '../helpers/test_app.dart';

/// Abre el formulario de alta como administrador. El servidor simulado rechaza con PRICE_BELOW_COST
/// una venta menor a la compra que no trae `confirmBelowCost`, igual que el servidor real (FR-004).
Future<ApiInventario> abrirFormulario(WidgetTester tester) async {
  final api = ApiInventario(rol: 'ADMIN', partes: [parteJson(1, 'Filtro de aceite')]);
  api.sobrescribir = (http.Request peticion) {
    if (peticion.method == 'POST' && peticion.url.path == '/api/parts') {
      final cuerpo = jsonDecode(peticion.body) as Map<String, dynamic>;
      final menor = (cuerpo['salePrice'] as num) < (cuerpo['purchasePrice'] as num);
      if (menor && cuerpo['confirmBelowCost'] != true) return errorVentaMenorAlCosto();
    }
    return null;
  };
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Inventario').first);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, 'Registrar refacción').first);
  await tester.pumpAndSettle();
  return api;
}

Future<void> llenar(WidgetTester tester, {required String compra, required String venta}) async {
  await tester.enterText(find.byKey(const Key('campo-codigo')), 'FRE-01');
  await tester.enterText(find.byKey(const Key('campo-nombre')), 'Disco de freno');
  await tester.enterText(find.byKey(const Key('campo-categoria')), 'Frenos');
  await tester.enterText(find.byKey(const Key('campo-marca')), 'Brembo');
  await tester.enterText(find.byKey(const Key('campo-stock-minimo')), '2');
  await tester.enterText(find.byKey(const Key('campo-precio-compra')), compra);
  await tester.enterText(find.byKey(const Key('campo-precio-venta')), venta);
}

Future<void> guardar(WidgetTester tester) async {
  final boton = find.widgetWithText(FilledButton, 'Guardar');
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  await tester.tap(boton);
  await tester.pumpAndSettle();
}

void main() {
  group('Venta menor al costo en el formulario de refacción', () {
    testWidgets('una_venta_menor_a_la_compra_abre_el_aviso_y_al_confirmar_reenvia_con_confirmBelowCost', (tester) async {
      final api = await abrirFormulario(tester);
      await llenar(tester, compra: '100', venta: '80');
      await guardar(tester);

      expect(find.text('Venta menor al costo'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Confirmar'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Cancelar'), findsWidgets);
      expect(api.enviadas('POST', '/api/parts'), hasLength(1));

      await tester.tap(find.widgetWithText(FilledButton, 'Confirmar'));
      await tester.pumpAndSettle();

      final envios = api.enviadas('POST', '/api/parts');
      expect(envios, hasLength(2));
      final segundo = jsonDecode(envios.last.body) as Map<String, dynamic>;
      expect(segundo, containsPair('confirmBelowCost', true));
      expect(find.text('Refacción registrada correctamente.'), findsOneWidget);
    });

    testWidgets('cancelar_el_aviso_no_guarda_y_el_formulario_sigue_abierto', (tester) async {
      final api = await abrirFormulario(tester);
      await llenar(tester, compra: '100', venta: '80');
      await guardar(tester);

      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.widgetWithText(OutlinedButton, 'Cancelar')));
      await tester.pumpAndSettle();

      expect(find.text('Venta menor al costo'), findsNothing);
      expect(find.text('Registrar refacción'), findsWidgets);
      expect(api.enviadas('POST', '/api/parts'), hasLength(1));
      expect(find.text('Refacción registrada correctamente.'), findsNothing);
    });

    testWidgets('con_venta_igual_o_mayor_a_la_compra_no_aparece_el_aviso_ni_se_envia_la_confirmacion', (tester) async {
      final api = await abrirFormulario(tester);
      await llenar(tester, compra: '100', venta: '100');
      await guardar(tester);

      expect(find.text('Venta menor al costo'), findsNothing);
      final envios = api.enviadas('POST', '/api/parts');
      expect(envios, hasLength(1));
      expect(jsonDecode(envios.single.body) as Map<String, dynamic>, isNot(contains('confirmBelowCost')));
      expect(find.text('Refacción registrada correctamente.'), findsOneWidget);
    });
  });
}
