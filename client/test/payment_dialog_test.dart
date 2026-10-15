import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/payment.dart';
import 'package:motorix_client/widgets/payment_dialog.dart';

import 'helpers/fake_api.dart';

PaymentSummary _resumen({double total = 1000, double paid = 0, double pending = 0}) =>
    PaymentSummary.fromJson(paymentSummaryJson(total: total, paid: paid, pending: pending));

/// Abre el diálogo desde un botón y guarda lo que devuelve en [resultado].
Future<void> _abrir(
  WidgetTester tester,
  PaymentSummary resumen,
  List<PaymentInput?> resultado, {
  bool allowMercadoPago = false,
}) async {
  tester.view.physicalSize = const Size(1200, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(MaterialApp(
    home: Builder(
      builder: (BuildContext context) => Scaffold(
        body: Center(
          child: ElevatedButton(
            onPressed: () async => resultado.add(
              await showPaymentDialog(context, summary: resumen, allowMercadoPago: allowMercadoPago),
            ),
            child: const Text('Abrir'),
          ),
        ),
      ),
    ),
  ));
  await tester.tap(find.text('Abrir'));
  await tester.pumpAndSettle();
}

Finder get _importe => find.widgetWithText(TextFormField, 'Importe *');
Finder get _registrar => find.widgetWithText(FilledButton, 'Registrar pago');

Future<void> _elegirMetodo(WidgetTester tester, String etiqueta) async {
  await tester.tap(find.byType(DropdownButtonFormField<PaymentMethod>));
  await tester.pumpAndSettle();
  await tester.tap(find.text(etiqueta).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_el_importe_por_omision_es_el_saldo_disponible', (WidgetTester tester) async {
    await _abrir(tester, _resumen(total: 1000, paid: 300, pending: 100), <PaymentInput?>[]);

    expect(find.text('Saldo disponible: \$600.00'), findsOneWidget);
    expect(tester.widget<TextFormField>(_importe).controller!.text, '600.00');
  });

  testWidgets('test_registra_efectivo_por_el_saldo_completo_sin_pedir_mas_datos', (WidgetTester tester) async {
    final List<PaymentInput?> resultado = <PaymentInput?>[];
    await _abrir(tester, _resumen(), resultado);

    await tester.tap(_registrar);
    await tester.pumpAndSettle();

    expect(resultado.single!.method, PaymentMethod.cash);
    expect(resultado.single!.amount, 1000);
    expect(resultado.single!.receivedAmount, isNull);
    expect(resultado.single!.reference, isNull);
  });

  testWidgets('test_un_importe_mayor_al_saldo_se_rechaza_en_el_formulario', (WidgetTester tester) async {
    final List<PaymentInput?> resultado = <PaymentInput?>[];
    await _abrir(tester, _resumen(), resultado);

    await tester.enterText(_importe, '1000.01');
    await tester.tap(_registrar);
    await tester.pumpAndSettle();

    expect(find.textContaining('No puede superar el saldo disponible'), findsOneWidget);
    expect(resultado, isEmpty, reason: 'el diálogo sigue abierto');
  });

  testWidgets('test_rechaza_importe_cero_vacio_o_con_tres_decimales', (WidgetTester tester) async {
    await _abrir(tester, _resumen(), <PaymentInput?>[]);

    await tester.enterText(_importe, '0');
    await tester.tap(_registrar);
    await tester.pumpAndSettle();
    expect(find.text('El importe debe ser mayor a cero.'), findsOneWidget);

    await tester.enterText(_importe, '');
    await tester.tap(_registrar);
    await tester.pumpAndSettle();
    expect(find.text('Ingresa el importe.'), findsOneWidget);

    await tester.enterText(_importe, '10.123');
    await tester.tap(_registrar);
    await tester.pumpAndSettle();
    expect(find.text('Usa un número con máximo dos decimales.'), findsOneWidget);
  });

  testWidgets('test_calcula_el_cambio_en_efectivo_con_el_importe_recibido', (WidgetTester tester) async {
    final List<PaymentInput?> resultado = <PaymentInput?>[];
    await _abrir(tester, _resumen(), resultado);

    await tester.enterText(_importe, '380.50');
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe recibido'), '500');
    await tester.pumpAndSettle();
    expect(find.text('Cambio: \$119.50'), findsOneWidget);

    await tester.tap(_registrar);
    await tester.pumpAndSettle();
    expect(resultado.single!.receivedAmount, 500);
  });

  testWidgets('test_el_importe_recibido_menor_al_importe_se_rechaza', (WidgetTester tester) async {
    await _abrir(tester, _resumen(), <PaymentInput?>[]);

    await tester.enterText(_importe, '300');
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe recibido'), '200');
    await tester.tap(_registrar);
    await tester.pumpAndSettle();

    expect(find.text('No puede ser menor al importe del pago.'), findsOneWidget);
  });

  testWidgets('test_la_referencia_solo_aparece_con_tarjeta_y_transferencia', (WidgetTester tester) async {
    final List<PaymentInput?> resultado = <PaymentInput?>[];
    await _abrir(tester, _resumen(), resultado);

    expect(find.widgetWithText(TextFormField, 'Referencia de la autorización'), findsNothing);
    expect(find.widgetWithText(TextFormField, 'Importe recibido'), findsOneWidget);

    await _elegirMetodo(tester, 'Tarjeta');
    expect(find.widgetWithText(TextFormField, 'Referencia de la autorización'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Importe recibido'), findsNothing);

    await tester.enterText(find.widgetWithText(TextFormField, 'Referencia de la autorización'), 'AUT-77');
    await tester.tap(_registrar);
    await tester.pumpAndSettle();
    expect(resultado.single!.method, PaymentMethod.card);
    expect(resultado.single!.reference, 'AUT-77');
    expect(resultado.single!.receivedAmount, isNull);
  });

  testWidgets('test_la_transferencia_pide_referencia_de_la_operacion', (WidgetTester tester) async {
    await _abrir(tester, _resumen(), <PaymentInput?>[]);

    await _elegirMetodo(tester, 'Transferencia');

    expect(find.widgetWithText(TextFormField, 'Referencia de la operación'), findsOneWidget);
  });

  testWidgets('test_el_formulario_no_pide_datos_de_tarjeta', (WidgetTester tester) async {
    await _abrir(tester, _resumen(), <PaymentInput?>[]);
    await _elegirMetodo(tester, 'Tarjeta');

    expect(find.textContaining('Número de tarjeta'), findsNothing);
    expect(find.textContaining('CVV'), findsNothing);
    expect(find.textContaining('Vencimiento'), findsNothing);
    expect(find.textContaining('No captures números de tarjeta'), findsOneWidget);
  });

  testWidgets('test_mercado_pago_solo_se_ofrece_cuando_esta_habilitado', (WidgetTester tester) async {
    await _abrir(tester, _resumen(), <PaymentInput?>[]);
    await tester.tap(find.byType(DropdownButtonFormField<PaymentMethod>));
    await tester.pumpAndSettle();

    expect(find.text('Mercado Pago'), findsNothing);
  });

  testWidgets('test_con_mercado_pago_habilitado_el_boton_dice_generar_cobro', (WidgetTester tester) async {
    final List<PaymentInput?> resultado = <PaymentInput?>[];
    await _abrir(tester, _resumen(), resultado, allowMercadoPago: true);

    await _elegirMetodo(tester, 'Mercado Pago');
    expect(find.widgetWithText(FilledButton, 'Generar cobro'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Generar cobro'));
    await tester.pumpAndSettle();
    expect(resultado.single!.method, PaymentMethod.mercadoPago);
  });

  testWidgets('test_cancelar_cierra_el_dialogo_sin_resultado', (WidgetTester tester) async {
    final List<PaymentInput?> resultado = <PaymentInput?>[];
    await _abrir(tester, _resumen(), resultado);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
    await tester.pumpAndSettle();

    expect(resultado, <PaymentInput?>[null]);
  });
}
