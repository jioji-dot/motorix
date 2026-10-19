import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/services/external_links.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s4.dart';
import '../helpers/test_app.dart';

Future<ApiCobros> abrirOrden(WidgetTester tester, {List<Map<String, dynamic>>? pagos, bool configurado = true}) async {
  final orden = ordenJson(7, estado: 'TERMINADO', mechanicId: 3, servicios: [servicioJson(1, 'Servicio', '1000.00')]);
  orden['total'] = '1000.00';
  final api = ApiCobros(
    rol: 'RECEPTIONIST',
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [orden],
    pagos: {7: pagos ?? []},
    mercadoPagoConfigurado: configurado,
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  return api;
}

Future<void> iniciarMercadoPago(WidgetTester tester, {String importe = '600'}) async {
  final boton = find.byKey(const Key('boton-registrar-pago'));
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  await tester.tap(boton);
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('campo-metodo-pago')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Mercado Pago').last);
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('campo-importe-pago')), importe);
  await tester.tap(find.widgetWithText(FilledButton, 'Generar enlace'));
  await tester.pumpAndSettle();
}

Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

void main() {
  late List<Uri> abiertas;

  setUp(() {
    abiertas = [];
    openExternalUrl = (direccion) async {
      abiertas.add(direccion);
      return true;
    };
  });

  group('Cobro con Mercado Pago', () {
    testWidgets('inicia_el_pago_y_muestra_el_enlace_el_codigo_QR_y_el_estado_Pendiente', (tester) async {
      final api = await abrirOrden(tester);
      await iniciarMercadoPago(tester);

      expect(jsonDecode(api.enviadas('POST', '/api/orders/7/payments').single.body), {'method': 'MERCADO_PAGO', 'amount': 600.0});
      expect(find.text('Enlace de pago de Mercado Pago'), findsOneWidget);
      expect(find.byKey(const Key('codigo-qr')), findsOneWidget);
      expect(find.byType(QrImageView), findsOneWidget);
      expect(find.descendant(of: find.byKey(const Key('enlace-de-pago')), matching: find.textContaining('https://sandbox.mercadopago.test/pagar/')), findsOneWidget);
      expect(find.textContaining('Pendiente de pago'), findsOneWidget);
    });

    testWidgets('el_boton_copiar_pone_el_enlace_en_el_portapapeles_y_abrir_lo_abre_en_el_navegador', (tester) async {
      await abrirOrden(tester);
      await iniciarMercadoPago(tester);

      String? copiado;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (llamada) async {
        if (llamada.method == 'Clipboard.setData') copiado = (llamada.arguments as Map)['text'] as String?;
        return null;
      });
      addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

      await tester.tap(find.byKey(const Key('boton-copiar-enlace')));
      await tester.pumpAndSettle();
      expect(copiado, startsWith('https://sandbox.mercadopago.test/pagar/'));
      expect(find.text('Enlace copiado.'), findsOneWidget);

      await tester.tap(find.byKey(const Key('boton-abrir-enlace')));
      await tester.pumpAndSettle();
      expect(abiertas.single.toString(), startsWith('https://sandbox.mercadopago.test/pagar/'));
    });

    testWidgets('el_pago_pendiente_reserva_saldo_y_se_lista_con_sus_acciones', (tester) async {
      await abrirOrden(tester);
      await iniciarMercadoPago(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Listo'));
      await tester.pumpAndSettle();

      expect(find.text('Mercado Pago · \$600.00'), findsOneWidget);
      expect(find.text('Pendiente'), findsWidgets);
      expect(find.text('Pendiente en Mercado Pago'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Actualizar estado'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Cancelar pago'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Ver enlace'), findsOneWidget);
      // Solo quedan 400 disponibles: no se puede cobrar más de eso.
      await tocarVisible(tester, find.byKey(const Key('boton-registrar-pago')));
      await tester.pumpAndSettle();
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-importe-pago'))).controller!.text, '400.00');
    });

    testWidgets('actualizar_estado_pasa_el_pago_a_Pagado_cuando_mercado_pago_lo_confirma', (tester) async {
      final api = await abrirOrden(tester, pagos: [pagoJson(900, 7, importe: '600.00', metodo: 'MERCADO_PAGO', estado: 'PENDIENTE', enlace: 'https://sandbox.mercadopago.test/pagar/r')]);
      api.resultadoDeMercadoPago[900] = 'PAGADO';

      await tocarVisible(tester, find.byKey(const Key('actualizar-900')));
      await tester.pumpAndSettle();

      expect(api.enviadas('POST', '/api/payments/900/sync'), hasLength(1));
      expect(find.text('Estado actualizado.'), findsOneWidget);
      expect(find.text('Pagado'), findsWidgets);
      expect(find.byKey(const Key('actualizar-900')), findsNothing);
    });

    testWidgets('si_mercado_pago_aun_no_confirma_el_pago_sigue_Pendiente_y_lo_avisa', (tester) async {
      await abrirOrden(tester, pagos: [pagoJson(900, 7, importe: '600.00', metodo: 'MERCADO_PAGO', estado: 'PENDIENTE', enlace: 'https://x/y')]);
      await tocarVisible(tester, find.byKey(const Key('actualizar-900')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('actualizar-900')), findsOneWidget);
    });

    testWidgets('cancelar_pide_confirmacion_libera_el_saldo_y_conserva_el_pago_como_Cancelado', (tester) async {
      final api = await abrirOrden(tester, pagos: [pagoJson(900, 7, importe: '600.00', metodo: 'MERCADO_PAGO', estado: 'PENDIENTE', enlace: 'https://x/y')]);

      await tocarVisible(tester, find.byKey(const Key('cancelar-900')));
      await tester.pumpAndSettle();
      expect(find.text('Cancelar pago'), findsWidgets);
      expect(find.textContaining('volverá a estar disponible'), findsOneWidget);

      // "Volver" no cancela nada.
      await tester.tap(find.widgetWithText(OutlinedButton, 'Volver'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/payments/900/cancel'), isEmpty);

      await tocarVisible(tester, find.byKey(const Key('cancelar-900')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Cancelar pago'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/payments/900/cancel'), hasLength(1));
      expect(find.text('Pago cancelado.'), findsOneWidget);
      expect(find.text('Cancelado'), findsOneWidget);
    });

    testWidgets('sin_configurar_muestra_el_mensaje_en_espanol_y_permite_cobrar_con_otro_metodo', (tester) async {
      final api = await abrirOrden(tester, configurado: false);
      await iniciarMercadoPago(tester);

      expect(find.text('Mercado Pago no está configurado en este servidor. Cobra con otro método.'), findsOneWidget);
      expect(find.text('Enlace de pago de Mercado Pago'), findsNothing);
      expect(find.text('Sin pagos registrados'), findsOneWidget);

      await tocarVisible(tester, find.byKey(const Key('boton-registrar-pago')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('campo-metodo-pago')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Efectivo').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/orders/7/payments'), hasLength(2));
      expect(find.text('Pagada'), findsOneWidget);
    });

    testWidgets('si_mercado_pago_no_responde_avisa_y_no_crea_ningun_pago', (tester) async {
      final api = await abrirOrden(tester);
      api.mercadoPagoCaido = true;
      await iniciarMercadoPago(tester);

      expect(find.textContaining('Mercado Pago no está disponible por ahora'), findsOneWidget);
      expect(find.text('Sin pagos registrados'), findsOneWidget);
    });
  });
}
