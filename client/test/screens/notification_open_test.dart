import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/screens/appointment_detail_screen.dart';
import 'package:motorix_client/screens/order_detail_screen.dart';
import 'package:motorix_client/screens/part_detail_screen.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/fake_api_s6.dart';
import '../helpers/test_app.dart';

Future<ApiAvisos> abrirPanel(WidgetTester tester, {String rol = 'ADMIN'}) async {
  final api = ApiAvisos(
    rol: rol,
    ordenes: [ordenJson(7, estado: 'EN_REPARACION')],
    citas: [citaJson(8, estado: 'CONFIRMADA')],
    partes: [parteJson(5, 'Sensor de oxígeno', stock: 0, minimo: 2)],
    mantenimientos: [mantenimientoJson(12, clasificacion: 'VENCIDO', placas: 'JKL-012-D')],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byKey(const Key('campana')));
  await tester.pumpAndSettle();
  return api;
}

Finder get contador => find.byKey(const Key('contador-avisos'));

/// Toca un botón del panel; si está fuera de la zona visible, primero se desplaza hasta él.
Future<void> tocar(WidgetTester tester, String clave) async {
  final boton = find.byKey(Key(clave));
  await tester.ensureVisible(boton);
  await tester.pumpAndSettle();
  await tester.tap(boton);
  await tester.pumpAndSettle();
}

void main() {
  group('Marcar como leído', () {
    testWidgets('baja_el_contador_y_atenua_el_aviso_sin_quitarlo', (tester) async {
      final api = await abrirPanel(tester);
      expect(tester.widget<Text>(contador).data, '4');
      await tocar(tester, 'leer-ORDEN:7');
      expect(tester.widget<Text>(contador).data, '3');
      expect(api.enviadas('POST', '/api/notifications/read'), hasLength(1));
      expect(find.byKey(const Key('aviso-ORDEN:7')), findsOneWidget);
      expect(find.byKey(const Key('leer-ORDEN:7')), findsNothing); // ya no ofrece marcarlo otra vez
    });

    testWidgets('al_leer_el_ultimo_aviso_desaparece_el_numero_de_la_campana', (tester) async {
      await abrirPanel(tester, rol: 'MECHANIC');
      expect(tester.widget<Text>(contador).data, '1');
      await tocar(tester, 'leer-ORDEN:7');
      expect(contador, findsNothing);
    });

    testWidgets('si_el_servidor_falla_muestra_el_mensaje_y_el_contador_no_cambia', (tester) async {
      final api = await abrirPanel(tester);
      api.sobrescribir = (p) => p.url.path == '/api/notifications/read'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await tocar(tester, 'leer-ORDEN:7');
      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(tester.widget<Text>(contador).data, '4');
    });
  });

  group('Abrir un aviso', () {
    testWidgets('una_orden_detenida_abre_el_detalle_de_la_orden', (tester) async {
      await abrirPanel(tester);
      await tocar(tester, 'abrir-ORDEN:7');
      expect(find.byType(OrderDetailScreen), findsOneWidget);
      expect(tester.widget<OrderDetailScreen>(find.byType(OrderDetailScreen)).orderId, 7);
      expect(find.byKey(const Key('panel-de-avisos')), findsNothing);
    });

    testWidgets('una_cita_de_hoy_abre_el_detalle_de_la_cita', (tester) async {
      await abrirPanel(tester);
      await tocar(tester, 'abrir-CITA:8');
      expect(tester.widget<AppointmentDetailScreen>(find.byType(AppointmentDetailScreen)).appointmentId, 8);
    });

    testWidgets('un_aviso_de_stock_abre_el_detalle_de_la_refaccion', (tester) async {
      await abrirPanel(tester);
      await tocar(tester, 'abrir-STOCK:5:AGOTADO');
      expect(tester.widget<PartDetailScreen>(find.byType(PartDetailScreen)).partId, 5);
    });

    testWidgets('un_mantenimiento_abre_la_seccion_con_la_placa_en_el_buscador', (tester) async {
      final api = await abrirPanel(tester);
      await tocar(tester, 'abrir-MANT:12:VENCIDO');
      expect(find.byKey(const Key('panel-de-avisos')), findsNothing);
      final campo = tester.widget<TextField>(find.byKey(const Key('campo-busqueda')));
      expect(campo.controller!.text, 'JKL-012-D');
      expect(api.enviadas('GET', '/api/maintenance').last.url.queryParameters['search'], 'JKL-012-D');
    });
  });
}
