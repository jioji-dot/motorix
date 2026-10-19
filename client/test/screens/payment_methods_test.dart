import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s4.dart';
import '../helpers/test_app.dart';

Future<ApiCobros> abrirRegistro(WidgetTester tester) async {
  final orden = ordenJson(7, estado: 'TERMINADO', mechanicId: 3, servicios: [servicioJson(1, 'Servicio', '1000.00')]);
  orden['total'] = '1000.00';
  final api = ApiCobros(
    rol: 'RECEPTIONIST',
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
  final boton = find.byKey(const Key('boton-registrar-pago'));
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  await tester.tap(boton);
  await tester.pumpAndSettle();
  return api;
}

Future<void> elegirMetodo(WidgetTester tester, String etiqueta) async {
  await tester.tap(find.byKey(const Key('campo-metodo-pago')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(etiqueta).last);
  await tester.pumpAndSettle();
}

void main() {
  group('Selector de método de pago', () {
    testWidgets('ofrece_efectivo_tarjeta_transferencia_y_mercado_pago', (tester) async {
      await abrirRegistro(tester);
      await tester.tap(find.byKey(const Key('campo-metodo-pago')));
      await tester.pumpAndSettle();
      for (final metodo in ['Efectivo', 'Tarjeta', 'Transferencia', 'Mercado Pago']) {
        expect(find.text(metodo), findsWidgets, reason: metodo);
      }
    });

    for (final (etiqueta, valor) in [('Efectivo', 'EFECTIVO'), ('Tarjeta', 'TARJETA'), ('Transferencia', 'TRANSFERENCIA')]) {
      testWidgets('registra_un_pago_con_${valor}_y_conserva_el_metodo_en_la_lista', (tester) async {
        final api = await abrirRegistro(tester);
        await elegirMetodo(tester, etiqueta);
        await tester.enterText(find.byKey(const Key('campo-importe-pago')), '250');
        await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
        await tester.pumpAndSettle();

        final envio = jsonDecode(api.enviadas('POST', '/api/orders/7/payments').single.body) as Map<String, dynamic>;
        expect(envio['method'], valor);
        expect(find.text('$etiqueta · \$250.00'), findsOneWidget);
      });
    }
  });

  group('Referencia del pago', () {
    testWidgets('la_etiqueta_cambia_segun_el_metodo_y_no_pide_datos_de_tarjeta', (tester) async {
      await abrirRegistro(tester);
      await elegirMetodo(tester, 'Tarjeta');
      expect(find.text('Número de autorización (opcional)'), findsOneWidget);
      expect(find.byKey(const Key('nota-terminal')), findsOneWidget);
      expect(find.textContaining('no pide ni guarda datos de tarjeta'), findsOneWidget);
      // No existen campos de número, vencimiento ni código de seguridad.
      expect(find.textContaining('vencimiento'), findsNothing);
      expect(find.textContaining('CVV'), findsNothing);
      expect(find.textContaining('Número de tarjeta'), findsNothing);

      await elegirMetodo(tester, 'Transferencia');
      expect(find.text('Referencia de la transferencia (opcional)'), findsOneWidget);
      expect(find.byKey(const Key('nota-terminal')), findsNothing);
    });

    testWidgets('rechaza_una_referencia_con_forma_de_numero_de_tarjeta_y_una_demasiado_larga', (tester) async {
      final api = await abrirRegistro(tester);
      await elegirMetodo(tester, 'Tarjeta');

      await tester.enterText(find.byKey(const Key('campo-referencia-pago')), '4111 1111 1111 1111');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();
      expect(find.text('La referencia no puede contener un número de tarjeta.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/orders/7/payments'), isEmpty);
    });

    testWidgets('acepta_un_numero_de_autorizacion_corto_y_lo_envia', (tester) async {
      final api = await abrirRegistro(tester);
      await elegirMetodo(tester, 'Tarjeta');
      await tester.enterText(find.byKey(const Key('campo-referencia-pago')), 'AUT 458213');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();
      final envio = jsonDecode(api.enviadas('POST', '/api/orders/7/payments').single.body) as Map<String, dynamic>;
      expect(envio['reference'], 'AUT 458213');
    });

    testWidgets('con_mercado_pago_no_se_pide_referencia_y_se_explica_el_enlace', (tester) async {
      await abrirRegistro(tester);
      await elegirMetodo(tester, 'Mercado Pago');
      expect(find.byKey(const Key('campo-referencia-pago')), findsNothing);
      expect(find.byKey(const Key('nota-mercado-pago')), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Generar enlace'), findsOneWidget);
    });
  });
}
