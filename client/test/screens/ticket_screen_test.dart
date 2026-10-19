import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/services/external_links.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s4.dart';
import '../helpers/test_app.dart';

Future<ApiCobros> abrirTicket(
  WidgetTester tester, {
  String rol = 'RECEPTIONIST',
  List<Map<String, dynamic>>? pagos,
  bool abrir = true,
}) async {
  final orden = ordenJson(
    7,
    estado: 'TERMINADO',
    mechanicId: 3,
    servicios: [servicioJson(1, 'Banda de accesorios nueva', '680.00')],
    manoDeObra: [manoDeObraJson(1, 'Cambio de banda', '1.50', '350.00', '525.00')],
  );
  orden['parts'] = [
    {'id': 1, 'partId': 3, 'code': 'F-1', 'name': 'Filtro de aceite', 'quantity': 2, 'unitPrice': '110.00', 'amount': '220.00'},
  ];
  orden['total'] = '1425.00';
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
  if (abrir && rol != 'MECHANIC') {
    final boton = find.byKey(const Key('boton-ticket'));
    await tester.ensureVisible(boton);
    await tester.pumpAndSettle();
    await tester.tap(boton);
    await tester.pumpAndSettle();
  }
  return api;
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

  group('Pantalla del ticket', () {
    testWidgets('genera_el_ticket_y_muestra_todos_los_datos', (tester) async {
      final api = await abrirTicket(tester, pagos: [pagoJson(1, 7, importe: '500.00'), pagoJson(2, 7, importe: '925.00', metodo: 'TARJETA', referencia: 'AUT 1')]);

      expect(api.enviadas('POST', '/api/orders/7/ticket'), hasLength(1));
      for (final texto in [
        'Motorix Taller Mecánico', 'Av. Principal 123', 'TK-000007', 'OS-000007', 'Roberto Hernández', 'Nissan Versa 2020', 'ABC-123-A',
        '45,000 km', 'Banda de accesorios nueva', 'Cambio de banda', 'Filtro de aceite', r'$1,425.00', 'Efectivo y Tarjeta', 'Pagado',
      ]) {
        expect(find.textContaining(texto), findsWidgets, reason: texto);
      }
      expect(find.text('Subtotal'), findsOneWidget);
      expect(find.text('Total'), findsOneWidget);
    });

    testWidgets('sin_pagos_el_estado_es_Pendiente_y_no_hay_metodo', (tester) async {
      await abrirTicket(tester);
      expect(find.text('Pendiente'), findsOneWidget);
      expect(find.text('Sin pagos registrados'), findsOneWidget);
    });

    testWidgets('con_un_pago_parcial_el_estado_es_Pago_parcial_y_muestra_el_saldo', (tester) async {
      await abrirTicket(tester, pagos: [pagoJson(1, 7, importe: '425.00')]);
      expect(find.text('Pago parcial'), findsOneWidget);
      expect(find.text(r'$1,000.00'), findsOneWidget); // saldo
    });

    testWidgets('generar_de_nuevo_conserva_el_mismo_folio', (tester) async {
      final api = await abrirTicket(tester);
      await tester.pageBack();
      await tester.pumpAndSettle();
      final boton = find.byKey(const Key('boton-ticket'));
      await tester.ensureVisible(boton);
      await tester.pumpAndSettle();
      await tester.tap(boton);
      await tester.pumpAndSettle();

      expect(find.text('TK-000007'), findsWidgets);
      expect(api.enviadas('POST', '/api/orders/7/ticket'), hasLength(2));
    });

    testWidgets('imprimir_pide_el_enlace_y_lo_abre_en_el_navegador', (tester) async {
      final api = await abrirTicket(tester);

      await tester.tap(find.byKey(const Key('boton-imprimir')));
      await tester.pumpAndSettle();

      expect(api.enviadas('POST', '/api/orders/7/ticket/print-link'), hasLength(1));
      expect(abiertas, [Uri.parse('http://prueba/api/tickets/print/token-de-prueba-0123456789')]);
    });

    testWidgets('si_no_se_puede_abrir_el_navegador_avisa_en_espanol', (tester) async {
      await abrirTicket(tester);
      openExternalUrl = (_) async => false;
      await tester.tap(find.byKey(const Key('boton-imprimir')));
      await tester.pumpAndSettle();
      expect(find.text('No se pudo abrir el navegador para imprimir el ticket.'), findsOneWidget);
    });

    testWidgets('si_la_api_rechaza_el_ticket_muestra_el_error_con_reintentar', (tester) async {
      final api = await abrirTicket(tester, abrir: false);
      api.sobrescribir = (p) => p.url.path.endsWith('/ticket') && p.method == 'POST'
          ? jsonResponse(409, {'error': {'code': 'TICKET_NOT_AVAILABLE', 'message': 'Solo las órdenes Terminadas o Entregadas tienen ticket.'}})
          : null;
      final boton = find.byKey(const Key('boton-ticket'));
      await tester.ensureVisible(boton);
      await tester.pumpAndSettle();
      await tester.tap(boton);
      await tester.pumpAndSettle();

      expect(find.text('Solo las órdenes Terminadas o Entregadas tienen ticket.'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Reintentar'), findsOneWidget);
    });

    testWidgets('el_mecanico_no_ve_el_boton_de_ticket', (tester) async {
      await abrirTicket(tester, rol: 'MECHANIC');
      expect(find.byKey(const Key('boton-ticket')), findsNothing);
    });
  });
}
