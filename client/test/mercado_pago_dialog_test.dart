import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/payment.dart';
import 'package:motorix_client/widgets/mercado_pago_dialog.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(2400, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Órdenes')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

Finder enDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.widgetWithText(FilledButton, texto));

const String _enlace = 'https://sandbox.mp.test/checkout/PREF-1';

/// Servidor falso con un cobro de Mercado Pago opcional.
class _Servidor {
  final List<Map<String, dynamic>> pagos = <Map<String, dynamic>>[];
  http.Response? errorAlCobrar;
  String resultadoAlActualizar = 'PENDIENTE';
  Map<String, dynamic>? ultimoCobro;

  Map<String, dynamic> get resumen {
    final double pendiente = pagos
        .where((Map<String, dynamic> p) => p['status'] == 'PENDIENTE')
        .fold(0, (double s, Map<String, dynamic> p) => s + (p['amount'] as double));
    final double pagado = pagos
        .where((Map<String, dynamic> p) => p['status'] == 'APROBADO')
        .fold(0, (double s, Map<String, dynamic> p) => s + (p['amount'] as double));
    return paymentSummaryJson(
      total: 1000,
      paid: pagado,
      pending: pendiente,
      status: pagado == 0 ? 'UNPAID' : (pagado >= 1000 ? 'PAID' : 'PARTIAL'),
    );
  }

  http.Response? responder(RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005', status: 'TERMINADO', total: 1000)]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') {
      return jsonData(orderJson(id: 5, folio: 'OS-000005', status: 'TERMINADO', total: 1000, payment: resumen));
    }
    if (r.path == '/orders/5/payments' && r.method == 'GET') {
      return jsonData(<String, dynamic>{'summary': resumen, 'payments': pagos});
    }
    if (r.path == '/orders/5/payments/mercado-pago' && r.method == 'POST') {
      ultimoCobro = r.body;
      if (errorAlCobrar != null) return errorAlCobrar;
      final Map<String, dynamic> pago = paymentJson(
        id: 1,
        method: 'MERCADO_PAGO',
        status: 'PENDIENTE',
        amount: ((r.body?['amount'] as num?) ?? 1000).toDouble(),
        paymentUrl: _enlace,
        externalReference: 'MTX-OS-000005-AB12CD34',
        canCancel: true,
        canRefresh: true,
      );
      pagos.add(pago);
      return jsonData(<String, dynamic>{'payment': pago, 'summary': resumen}, status: 201);
    }
    if (r.path == '/payments/1/refresh' && r.method == 'POST') {
      pagos[0] = <String, dynamic>{
        ...pagos[0],
        'status': resultadoAlActualizar,
        'canCancel': resultadoAlActualizar == 'PENDIENTE',
        'canRefresh': resultadoAlActualizar == 'PENDIENTE',
      };
      return jsonData(<String, dynamic>{'payment': pagos[0], 'summary': resumen});
    }
    if (r.path == '/payments/1/cancel' && r.method == 'POST') {
      pagos[0] = <String, dynamic>{...pagos[0], 'status': 'CANCELADO', 'canCancel': false, 'canRefresh': false};
      return jsonData(<String, dynamic>{'payment': pagos[0], 'summary': resumen});
    }
    return null;
  }
}

Future<void> elegirMercadoPago(WidgetTester tester) async {
  await tester.tap(find.text('Registrar pago'));
  await tester.pumpAndSettle();
  await tester.tap(find.byType(DropdownButtonFormField<PaymentMethod>));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Mercado Pago').last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_crea_el_cobro_y_muestra_el_enlace_con_el_importe_reservado', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await elegirMercadoPago(tester);
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();

    expect(servidor.ultimoCobro, <String, dynamic>{'amount': 1000.0});
    expect(find.text('Cobro de Mercado Pago creado'), findsOneWidget);
    expect(find.text('Importe reservado: \$1,000.00'), findsOneWidget);
    expect(find.text(_enlace), findsOneWidget);
    expect(find.textContaining('nunca se piden datos de tarjeta'), findsOneWidget);
  });

  testWidgets('test_copiar_el_enlace_lo_deja_en_el_portapapeles', (WidgetTester tester) async {
    final List<String?> copiado = <String?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (MethodCall call) async {
      if (call.method == 'Clipboard.setData') copiado.add((call.arguments as Map<dynamic, dynamic>)['text'] as String?);
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

    final Payment pago = Payment.fromJson(paymentJson(method: 'MERCADO_PAGO', status: 'PENDIENTE', paymentUrl: _enlace));
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (BuildContext context) => Scaffold(
          body: ElevatedButton(
            onPressed: () => showMercadoPagoLinkDialog(context, payment: pago, onOpen: (Payment p) async {}),
            child: const Text('Abrir'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Copiar enlace'));
    await tester.pumpAndSettle();

    expect(copiado, <String?>[_enlace]);
    expect(find.text('Enlace copiado.'), findsOneWidget);
  });

  testWidgets('test_abrir_el_enlace_llama_al_callback_con_el_pago', (WidgetTester tester) async {
    final List<int> abiertos = <int>[];
    final Payment pago = Payment.fromJson(paymentJson(id: 9, method: 'MERCADO_PAGO', status: 'PENDIENTE', paymentUrl: _enlace));
    await tester.pumpWidget(MaterialApp(
      home: Builder(
        builder: (BuildContext context) => Scaffold(
          body: ElevatedButton(
            onPressed: () => showMercadoPagoLinkDialog(context, payment: pago, onOpen: (Payment p) async => abiertos.add(p.id)),
            child: const Text('Abrir'),
          ),
        ),
      ),
    ));
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Abrir enlace'));
    await tester.pump();

    expect(abiertos, <int>[9]);
  });

  testWidgets('test_sin_configuracion_muestra_el_mensaje_claro_y_no_hay_cobro', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor()
      ..errorAlCobrar = jsonError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Mercado Pago no está configurado. Cobra con otro método.');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await elegirMercadoPago(tester);
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();

    expect(find.text('Mercado Pago no está configurado. Cobra con otro método.'), findsOneWidget);
    expect(find.text('Cobro de Mercado Pago creado'), findsNothing);
    expect(find.text('Aún no hay pagos registrados.'), findsOneWidget);
  });

  testWidgets('test_un_importe_mayor_al_saldo_se_rechaza_en_el_formulario', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await elegirMercadoPago(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe *'), '1200');
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();

    expect(find.textContaining('No puede superar el saldo disponible'), findsOneWidget);
    expect(servidor.ultimoCobro, isNull);
  });

  testWidgets('test_con_un_cobro_pendiente_existente_muestra_el_error_del_servidor', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor()
      ..errorAlCobrar = jsonError(409, 'PAYMENT_PENDING_EXISTS',
          'La orden ya tiene un cobro de Mercado Pago pendiente. Cancélalo o actualiza su estado primero.');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await elegirMercadoPago(tester);
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();

    expect(find.textContaining('ya tiene un cobro de Mercado Pago pendiente'), findsOneWidget);
  });

  testWidgets('test_actualizar_el_estado_cambia_el_cobro_a_aprobado', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);
    await elegirMercadoPago(tester);
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Listo'));
    await tester.pumpAndSettle();
    expect(find.text('Pendiente'), findsWidgets);

    servidor.resultadoAlActualizar = 'APROBADO';
    await tester.tap(find.byTooltip('Actualizar estado'));
    await tester.pumpAndSettle();

    expect(find.text('Aprobado'), findsOneWidget);
    expect(find.text('Pagada'), findsOneWidget);
    expect(find.byTooltip('Actualizar estado'), findsNothing);
  });

  testWidgets('test_si_mercado_pago_aun_no_informa_el_cobro_sigue_pendiente', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);
    await elegirMercadoPago(tester);
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Listo'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Actualizar estado'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Mercado Pago aún no informa el pago'), findsOneWidget);
    expect(find.byTooltip('Actualizar estado'), findsOneWidget);
  });

  testWidgets('test_cancelar_el_cobro_pide_confirmacion_y_libera_el_saldo', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);
    await elegirMercadoPago(tester);
    await tester.tap(enDialogo('Generar cobro'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Listo'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Cancelar cobro'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget, reason: 'primero pide confirmación');
    await tester.tap(enDialogo('Cancelar cobro'));
    await tester.pumpAndSettle();

    expect(find.text('Cancelado'), findsOneWidget);
    expect(find.text('Registrar pago'), findsOneWidget, reason: 'el saldo vuelve a estar disponible');
  });
}
