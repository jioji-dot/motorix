import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api, {String role = 'RECEPTIONIST'}) async {
  tester.view.physicalSize = const Size(2400, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (role != 'MECHANIC') {
    await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Órdenes')));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

Finder enDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.widgetWithText(FilledButton, texto));

/// Estado mutable del servidor falso para una orden con cobro.
class _Servidor {
  _Servidor({this.status = 'TERMINADO'});

  String status;
  final double _total = 1000;
  final List<Map<String, dynamic>> pagos = <Map<String, dynamic>>[];
  http.Response? errorAlRegistrar;
  RecordedRequest? ultimoRegistro;

  double get _pagado => pagos
      .where((Map<String, dynamic> p) => p['status'] == 'APROBADO')
      .fold(0, (double s, Map<String, dynamic> p) => s + (p['amount'] as double));

  Map<String, dynamic> get resumen => paymentSummaryJson(
        total: _total,
        paid: _pagado,
        status: _pagado == 0 ? 'UNPAID' : (_pagado >= _total ? 'PAID' : 'PARTIAL'),
      );

  Map<String, dynamic> get orden =>
      orderJson(id: 5, folio: 'OS-000005', status: status, total: _total, payment: resumen);

  http.Response? responder(RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005', status: status, total: _total)]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') return jsonData(orden);
    if (r.path == '/orders/5/payments' && r.method == 'GET') {
      return jsonData(<String, dynamic>{'summary': resumen, 'payments': pagos});
    }
    if (r.path == '/orders/5/payments' && r.method == 'POST') {
      ultimoRegistro = r;
      if (errorAlRegistrar != null) return errorAlRegistrar;
      final Map<String, dynamic> pago = paymentJson(
        id: pagos.length + 1,
        method: r.body!['method'] as String,
        amount: (r.body!['amount'] as num).toDouble(),
        canVoid: true,
      );
      pagos.add(pago);
      return jsonData(<String, dynamic>{'payment': pago, 'summary': resumen}, status: 201);
    }
    if (r.path.startsWith('/payments/') && r.path.endsWith('/void') && r.method == 'POST') {
      pagos[0] = <String, dynamic>{...pagos[0], 'status': 'ANULADO', 'voidReason': r.body!['reason'], 'canVoid': false};
      return jsonData(<String, dynamic>{'payment': pagos[0], 'summary': resumen});
    }
    return null;
  }
}

void main() {
  testWidgets('test_recepcion_registra_un_pago_en_efectivo_y_el_saldo_se_actualiza', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    expect(find.text('Pagos'), findsWidgets);
    expect(find.text('Aún no hay pagos registrados.'), findsOneWidget);
    expect(find.text('Sin pagar'), findsOneWidget);

    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    expect(find.text('Saldo disponible: \$1,000.00'), findsOneWidget);

    await tester.enterText(find.widgetWithText(TextFormField, 'Importe *'), '400');
    await tester.tap(enDialogo('Registrar pago'));
    await tester.pumpAndSettle();

    expect(servidor.ultimoRegistro!.body, <String, dynamic>{'method': 'CASH', 'amount': 400.0});
    expect(find.text('Pago parcial'), findsOneWidget);
    expect(find.text('Efectivo'), findsOneWidget);
  });

  testWidgets('test_no_permite_registrar_un_importe_mayor_al_saldo', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextFormField, 'Importe *'), '1500');
    await tester.tap(enDialogo('Registrar pago'));
    await tester.pumpAndSettle();

    expect(find.textContaining('No puede superar el saldo disponible'), findsOneWidget);
    expect(servidor.ultimoRegistro, isNull, reason: 'no se debe llamar al servidor con un importe inválido');
  });

  testWidgets('test_muestra_el_error_del_servidor_al_rechazar_el_pago', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor()
      ..errorAlRegistrar = jsonError(409, 'PAYMENT_EXCEEDS_BALANCE', 'El importe supera el saldo disponible.');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar pago'));
    await tester.pumpAndSettle();
    await tester.tap(enDialogo('Registrar pago'));
    await tester.pumpAndSettle();

    expect(find.text('El importe supera el saldo disponible.'), findsOneWidget);
  });

  testWidgets('test_no_ofrece_registrar_pagos_si_la_orden_no_esta_terminada', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor(status: 'EN_REPARACION');
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    // Una orden en reparación no es cobrable: no aparece la sección de pagos.
    expect(find.text('Registrar pago'), findsNothing);
    expect(api.requests.where((RecordedRequest r) => r.path == '/orders/5/payments'), isEmpty);
  });

  testWidgets('test_el_mecanico_no_ve_la_seccion_de_pagos_ni_la_consulta', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: servidor.responder));
    await abrirOrden(tester, api, role: 'MECHANIC');

    expect(find.text('Registrar pago'), findsNothing);
    expect(find.text('Sin pagar'), findsNothing);
    expect(api.requests.where((RecordedRequest r) => r.path.contains('/payments')), isEmpty);
  });

  testWidgets('test_el_administrador_anula_un_pago_con_motivo_y_confirmacion', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    servidor.pagos.add(paymentJson(id: 1, amount: 1000, canVoid: true));
    final FakeApi api = FakeApi(baseHandler(role: 'ADMIN', extra: servidor.responder));
    await abrirOrden(tester, api, role: 'ADMIN');

    await tester.tap(find.byTooltip('Anular pago'));
    await tester.pumpAndSettle();

    // Sin motivo no se puede continuar.
    await tester.tap(enDialogo('Anular pago'));
    await tester.pumpAndSettle();
    expect(find.textContaining('motivo'), findsWidgets);

    await tester.enterText(find.widgetWithText(TextFormField, 'Motivo de la anulación *'), 'Cobro duplicado');
    await tester.tap(enDialogo('Anular pago'));
    await tester.pumpAndSettle();

    // Confirmación final.
    await tester.tap(enDialogo('Anular pago'));
    await tester.pumpAndSettle();

    final RecordedRequest llamada =
        api.requests.lastWhere((RecordedRequest r) => r.path.endsWith('/void') && r.method == 'POST');
    expect(llamada.body, <String, dynamic>{'reason': 'Cobro duplicado'});
    expect(find.text('Anulado'), findsOneWidget);
  });

  testWidgets('test_recepcion_no_ve_la_accion_de_anular', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    servidor.pagos.add(paymentJson(id: 1, amount: 1000, canVoid: true));
    final FakeApi api = FakeApi(baseHandler(extra: servidor.responder));
    await abrirOrden(tester, api);

    expect(find.byTooltip('Anular pago'), findsNothing, reason: 'solo el administrador anula pagos');
  });

  testWidgets('test_al_entregar_con_saldo_pendiente_se_muestra_el_saldo_en_la_confirmacion', (WidgetTester tester) async {
    final _Servidor servidor = _Servidor();
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/orders/5' && r.method == 'GET') {
        return jsonData(<String, dynamic>{
          ...servidor.orden,
          'allowedTransitions': <String>['ENTREGADO'],
        });
      }
      return servidor.responder(r);
    }));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Marcar como entregado'));
    await tester.pumpAndSettle();

    expect(find.textContaining('saldo pendiente de \$1,000.00'), findsOneWidget);
  });
}
