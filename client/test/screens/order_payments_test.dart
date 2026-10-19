import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s4.dart';
import '../helpers/test_app.dart';

Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

/// Abre el detalle de la orden OS-000007 (Terminada, total 1000.00 salvo que se indique otra cosa).
Future<ApiCobros> abrirOrden(
  WidgetTester tester, {
  String rol = 'RECEPTIONIST',
  String estado = 'TERMINADO',
  String total = '1000.00',
  List<Map<String, dynamic>>? pagos,
}) async {
  final orden = ordenJson(7, estado: estado, mechanicId: 3, servicios: [servicioJson(1, 'Servicio de prueba', total)]);
  orden['total'] = total;
  final api = ApiCobros(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [orden],
    pagos: {7: pagos ?? []},
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  return api;
}

Future<void> abrirRegistro(WidgetTester tester) async {
  await tocarVisible(tester, find.byKey(const Key('boton-registrar-pago')));
  await tester.pumpAndSettle();
}

Future<void> elegirMetodo(WidgetTester tester, String etiqueta) async {
  await tester.tap(find.byKey(const Key('campo-metodo-pago')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(etiqueta).last);
  await tester.pumpAndSettle();
}

void main() {
  group('Bloque de pagos del detalle de la orden', () {
    testWidgets('muestra_el_resumen_de_cobro_y_los_pagos_registrados', (tester) async {
      await abrirOrden(tester, pagos: [pagoJson(1, 7, importe: '400.00', referencia: 'Recibo 15'), pagoJson(2, 7, importe: '100.00', metodo: 'TRANSFERENCIA', referencia: 'SPEI 1')]);

      expect(find.byKey(const Key('seccion-pagos')), findsOneWidget);
      expect(find.text('Pago parcial'), findsOneWidget);
      expect(find.text(r'$1,000.00'), findsWidgets);
      expect(find.text(r'$500.00'), findsWidgets); // pagado
      expect(find.text('Efectivo · \$400.00'), findsOneWidget);
      expect(find.text('Transferencia · \$100.00'), findsOneWidget);
      expect(find.textContaining('Recibo 15'), findsOneWidget);
    });

    testWidgets('sin_pagos_dice_que_no_hay_registrados_y_el_estado_es_Sin_pagos', (tester) async {
      await abrirOrden(tester);
      expect(find.text('Sin pagos registrados'), findsOneWidget);
      expect(find.text('Sin pagos'), findsOneWidget);
    });

    for (final rol in ['RECEPTIONIST', 'ADMIN']) {
      testWidgets('el_rol_${rol}_ve_el_bloque_y_el_boton_de_registrar', (tester) async {
        await abrirOrden(tester, rol: rol);
        expect(find.byKey(const Key('boton-registrar-pago')), findsOneWidget);
        expect(find.byKey(const Key('boton-ticket')), findsOneWidget);
      });
    }

    testWidgets('el_mecanico_no_ve_el_bloque_de_pagos', (tester) async {
      await abrirOrden(tester, rol: 'MECHANIC');
      expect(find.byKey(const Key('seccion-pagos')), findsNothing);
    });

    testWidgets('una_orden_en_curso_no_muestra_pagos', (tester) async {
      await abrirOrden(tester, estado: 'EN_REPARACION');
      expect(find.byKey(const Key('seccion-pagos')), findsNothing);
    });

    testWidgets('una_orden_entregada_sigue_admitiendo_cobros', (tester) async {
      await abrirOrden(tester, estado: 'ENTREGADO');
      expect(find.byKey(const Key('boton-registrar-pago')), findsOneWidget);
    });

    testWidgets('una_orden_pagada_completa_ya_no_ofrece_registrar_pagos', (tester) async {
      await abrirOrden(tester, pagos: [pagoJson(1, 7, importe: '1000.00')]);
      expect(find.text('Pagada'), findsOneWidget);
      expect(find.byKey(const Key('boton-registrar-pago')), findsNothing);
      expect(find.byKey(const Key('boton-ticket')), findsOneWidget);
    });
  });

  group('Registrar un pago', () {
    testWidgets('el_importe_viene_con_el_saldo_disponible_y_el_pago_se_envia_y_actualiza_el_resumen', (tester) async {
      final api = await abrirOrden(tester);
      await abrirRegistro(tester);

      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-importe-pago'))).controller!.text, '1000.00');
      await elegirMetodo(tester, 'Efectivo');
      await tester.enterText(find.byKey(const Key('campo-importe-pago')), '400');
      await tester.enterText(find.byKey(const Key('campo-referencia-pago')), 'Recibo 9');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('POST', '/api/orders/7/payments').single.body) as Map<String, dynamic>;
      expect(envio, {'method': 'EFECTIVO', 'amount': 400.0, 'reference': 'Recibo 9'});
      expect(find.text('Pago registrado.'), findsOneWidget);
      expect(find.text('Pago parcial'), findsOneWidget);
      expect(find.text('Efectivo · \$400.00'), findsOneWidget);
    });

    testWidgets('el_pago_por_el_saldo_deja_la_orden_Pagada', (tester) async {
      await abrirOrden(tester);
      await abrirRegistro(tester);
      await elegirMetodo(tester, 'Transferencia');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();

      expect(find.text('Pagada'), findsOneWidget);
      expect(find.byKey(const Key('boton-registrar-pago')), findsNothing);
    });

    testWidgets('valida_el_metodo_obligatorio_y_los_importes_invalidos_en_espanol', (tester) async {
      final api = await abrirOrden(tester);
      await abrirRegistro(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();
      expect(find.text('El método de pago es obligatorio.'), findsOneWidget);

      await elegirMetodo(tester, 'Efectivo');
      for (final (valor, mensaje) in [
        ('', 'El importe es obligatorio.'),
        ('0', 'El importe debe ser mayor a 0.'),
        ('-5', 'El importe debe ser mayor a 0.'),
        ('10.123', 'El importe puede tener hasta dos decimales.'),
        ('abc', 'El importe no es válido.'),
        ('1000.01', r'El importe no puede ser mayor al saldo disponible ($1,000.00).'),
      ]) {
        await tester.enterText(find.byKey(const Key('campo-importe-pago')), valor);
        await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
        await tester.pumpAndSettle();
        expect(find.text(mensaje), findsOneWidget, reason: 'importe "$valor"');
      }
      expect(api.enviadas('POST', '/api/orders/7/payments'), isEmpty);
    });

    testWidgets('si_el_saldo_cambio_el_mensaje_de_la_api_se_muestra_y_se_recarga_el_resumen', (tester) async {
      final api = await abrirOrden(tester);
      // Otra persona cobra 700 mientras esta captura el pago.
      api.pagos[7]!.add(pagoJson(55, 7, importe: '700.00'));
      await abrirRegistro(tester);
      await elegirMetodo(tester, 'Tarjeta');
      await tester.enterText(find.byKey(const Key('campo-importe-pago')), '500');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('excede el saldo disponible'), findsOneWidget);
      expect(find.text('Pago parcial'), findsOneWidget);
    });
  });
}
