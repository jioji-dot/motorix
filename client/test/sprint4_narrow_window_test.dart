import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/payment.dart';
import 'package:motorix_client/widgets/mercado_pago_dialog.dart';
import 'package:motorix_client/widgets/payment_dialog.dart';

import 'helpers/fake_api.dart';

/// Ventana angosta (800 px): ninguna pantalla ni diálogo del Sprint 4 debe desbordarse.
Future<void> iniciarSesionAngosta(WidgetTester tester, FakeApi api, {double alto = 900}) async {
  tester.view.physicalSize = Size(800, alto);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

const String _nombreLargo = 'Ana Pérez Morales de la Cruz con un nombre bastante largo para probar el ajuste';

http.Response? Function(RecordedRequest) manejador() {
  final Map<String, dynamic> resumen = paymentSummaryJson(total: 1705, paid: 1000, pending: 300, status: 'PARTIAL');
  final List<Map<String, dynamic>> pagos = <Map<String, dynamic>>[
    paymentJson(id: 1, clientName: _nombreLargo, method: 'CARD', amount: 1000, reference: 'AUT-EJEMPLO-4521', canVoid: true),
    paymentJson(
      id: 2,
      method: 'MERCADO_PAGO',
      amount: 300,
      status: 'PENDIENTE',
      externalReference: 'MTX-OS-000005-AB12CD34',
      paymentUrl: 'https://sandbox.mercadopago.example/EJEMPLO',
      canCancel: true,
      canRefresh: true,
    ),
  ];
  return (RecordedRequest r) {
    if (r.path == '/dashboard') return jsonData(dashboardJson());
    if (r.path == '/payments' && r.method == 'GET') {
      return jsonData(pagos, meta: <String, dynamic>{'page': 1, 'pageSize': 20, 'total': 2, 'approvedTotal': 1000.0});
    }
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[
        orderJson(id: 5, folio: 'OS-000005', clientName: _nombreLargo, status: 'TERMINADO', total: 1705, paymentStatus: 'PARTIAL'),
      ]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') {
      return jsonData(orderJson(
        id: 5,
        folio: 'OS-000005',
        clientName: _nombreLargo,
        status: 'TERMINADO',
        total: 1705,
        payment: resumen,
        paymentStatus: 'PARTIAL',
        ticketId: 3,
        allowedTransitions: <String>['ENTREGADO'],
      ));
    }
    if (r.path == '/orders/5/payments' && r.method == 'GET') {
      return jsonData(<String, dynamic>{'summary': resumen, 'payments': pagos});
    }
    if (r.path == '/tickets/3' && r.method == 'GET') return jsonData(ticketJson(id: 3));
    return null;
  };
}

FakeApi api({String role = 'ADMIN'}) => FakeApi(baseHandler(role: role, extra: manejador()));

void main() {
  testWidgets('test_el_panel_no_se_desborda_en_800_px', (WidgetTester tester) async {
    await iniciarSesionAngosta(tester, api());

    expect(find.text('Cobrado hoy'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('test_el_detalle_de_la_orden_con_pagos_no_se_desborda_en_800_px', (WidgetTester tester) async {
    await iniciarSesionAngosta(tester, api());
    await tester.tap(find.byTooltip('Expandir menú'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Órdenes')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OS-000005'));
    await tester.pumpAndSettle();

    expect(find.text('Pagos'), findsWidgets);
    expect(find.text('Ver ticket'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('test_el_listado_de_pagos_no_se_desborda_en_800_px', (WidgetTester tester) async {
    await iniciarSesionAngosta(tester, api());
    await tester.tap(find.byTooltip('Expandir menú'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Pagos')));
    await tester.pumpAndSettle();

    expect(find.text('Total aprobado con estos filtros: \$1,000.00'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('test_el_ticket_no_se_desborda_en_800_px', (WidgetTester tester) async {
    await iniciarSesionAngosta(tester, api());
    await tester.tap(find.byTooltip('Expandir menú'));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Órdenes')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OS-000005'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Ver ticket'));
    await tester.tap(find.text('Ver ticket'));
    await tester.pumpAndSettle();

    expect(find.text('Ticket TK-000003'), findsOneWidget);
    expect(find.text('Imprimir'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('test_los_dialogos_de_pago_y_de_mercado_pago_no_se_desbordan_en_800_px', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    final PaymentSummary resumen = PaymentSummary.fromJson(paymentSummaryJson(total: 1705, paid: 1000));
    final Payment pago = Payment.fromJson(paymentJson(
      method: 'MERCADO_PAGO',
      status: 'PENDIENTE',
      paymentUrl: 'https://sandbox.mercadopago.example/EJEMPLO-con-un-enlace-bastante-largo-para-probar-el-ajuste-de-texto',
    ));

    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (BuildContext context) => Scaffold(
          body: Column(
            children: <Widget>[
              ElevatedButton(
                onPressed: () => showPaymentDialog(context, summary: resumen, allowMercadoPago: true),
                child: const Text('Pago'),
              ),
              ElevatedButton(
                onPressed: () => showMercadoPagoLinkDialog(context, payment: pago, onOpen: (Payment p) async {}),
                child: const Text('Enlace'),
              ),
            ],
          ),
        ),
      ),
    ));

    await tester.tap(find.text('Pago'));
    await tester.pumpAndSettle();
    expect(find.text('Registrar pago'), findsWidgets);
    expect(tester.takeException(), isNull);
    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Enlace'));
    await tester.pumpAndSettle();
    expect(find.text('Cobro de Mercado Pago creado'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
