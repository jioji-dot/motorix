import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/payment.dart';
import 'package:motorix_client/widgets/payment_summary_card.dart';
import 'package:motorix_client/widgets/payments_table.dart';

import 'helpers/fake_api.dart';

Widget _envolver(Widget hijo) => MaterialApp(home: Scaffold(body: SingleChildScrollView(child: hijo)));

void main() {
  test('test_el_resumen_interpreta_importes_y_calcula_si_se_puede_cobrar', () {
    final PaymentSummary resumen =
        PaymentSummary.fromJson(paymentSummaryJson(total: 1000, paid: 400, pending: 100, status: 'PARTIAL'));

    expect(resumen.balance, 600);
    expect(resumen.available, 500);
    expect(resumen.status, OrderPaymentStatus.partial);
    expect(resumen.canCharge, isTrue);
  });

  test('test_no_se_puede_cobrar_una_orden_pagada_ni_sin_cobro', () {
    final PaymentSummary pagada =
        PaymentSummary.fromJson(paymentSummaryJson(total: 800, paid: 800, status: 'PAID'));
    final PaymentSummary sinCobro =
        PaymentSummary.fromJson(paymentSummaryJson(total: 0, status: 'NO_CHARGE'));

    expect(pagada.canCharge, isFalse, reason: 'sin saldo disponible no se registran pagos');
    expect(sinCobro.canCharge, isFalse, reason: 'una orden sin importe no se cobra');
  });

  testWidgets('test_la_tarjeta_muestra_total_pagado_saldo_y_estado', (WidgetTester tester) async {
    await tester.pumpWidget(_envolver(PaymentSummaryCard(
      summary: PaymentSummary.fromJson(
        paymentSummaryJson(total: 1000, paid: 400, status: 'PARTIAL'),
      ),
    )));

    expect(find.text('Pago parcial'), findsOneWidget);
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('Pagado'), findsOneWidget);
    expect(find.text('Saldo'), findsOneWidget);
    expect(find.text('Pendiente de Mercado Pago'), findsNothing,
        reason: 'sin cobros pendientes no se muestra esa columna');
  });

  testWidgets('test_la_tarjeta_muestra_lo_pendiente_de_mercado_pago', (WidgetTester tester) async {
    await tester.pumpWidget(_envolver(PaymentSummaryCard(
      summary: PaymentSummary.fromJson(paymentSummaryJson(total: 1000, pending: 300)),
    )));

    expect(find.text('Pendiente de Mercado Pago'), findsOneWidget);
  });

  testWidgets('test_la_tabla_solo_ofrece_las_acciones_que_permite_el_servidor', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1800, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    final List<String> acciones = <String>[];
    await tester.pumpWidget(_envolver(PaymentsTable(
      payments: <Payment>[
        Payment.fromJson(paymentJson(id: 1, status: 'APROBADO', canVoid: true)),
        Payment.fromJson(paymentJson(
          id: 2,
          method: 'MERCADO_PAGO',
          status: 'PENDIENTE',
          canCancel: true,
          paymentUrl: 'https://mp.test/pago',
        )),
      ],
      onCancel: (Payment p) => acciones.add('cancelar ${p.id}'),
      onVoid: (Payment p) => acciones.add('anular ${p.id}'),
    )));

    expect(find.byTooltip('Anular pago'), findsOneWidget);
    expect(find.byTooltip('Cancelar cobro'), findsOneWidget);
    expect(find.byTooltip('Abrir enlace de pago'), findsNothing, reason: 'no se entregó onOpenLink');

    await tester.tap(find.byTooltip('Anular pago'));
    await tester.tap(find.byTooltip('Cancelar cobro'));
    expect(acciones, <String>['anular 1', 'cancelar 2']);
  });

  testWidgets('test_la_tabla_vacia_avisa_que_no_hay_pagos', (WidgetTester tester) async {
    await tester.pumpWidget(_envolver(const PaymentsTable(payments: <Payment>[])));

    expect(find.text('Aún no hay pagos registrados.'), findsOneWidget);
  });
}
