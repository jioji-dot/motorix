import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s7.dart';
import '../helpers/test_app.dart';

Future<ApiAdmin> abrirOrden(WidgetTester tester, {String estado = 'EN_REPARACION', String rol = 'ADMIN'}) async {
  final api = ApiAdmin(
    rol: rol,
    aceptado: true,
    ordenes: [ordenJson(7, estado: estado, mechanicId: 3, diagnostico: 'Diagnóstico', servicios: [servicioJson(1, 'Aceite', '500.00')])],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  group('Tipo de servicio en la línea', () {
    testWidgets('el_dialogo_ofrece_los_tipos_activos_y_envia_el_elegido', (tester) async {
      final api = await abrirOrden(tester);
      final agregar = find.widgetWithText(OutlinedButton, 'Agregar servicio');
      await tester.ensureVisible(agregar);
      await tester.tap(agregar);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('campo-tipo-de-servicio-linea')), findsOneWidget);
      await tester.tap(find.byKey(const Key('campo-tipo-de-servicio-linea')));
      await tester.pumpAndSettle();
      expect(find.text('Frenos'), findsNothing); // desactivado: no se ofrece para líneas nuevas
      await tester.tap(find.text('Cambio de aceite').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Aceite sintético');
      await tester.enterText(find.byKey(const Key('campo-importe')), '450');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/orders/7/services').single.body, contains('"serviceTypeId":1'));
    });

    testWidgets('sin_elegir_tipo_no_se_envia_serviceTypeId', (tester) async {
      final api = await abrirOrden(tester);
      final agregar = find.widgetWithText(OutlinedButton, 'Agregar servicio');
      await tester.ensureVisible(agregar);
      await tester.tap(agregar);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Libre');
      await tester.enterText(find.byKey(const Key('campo-importe')), '100');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/orders/7/services').single.body, isNot(contains('serviceTypeId')));
    });
  });

  group('Propuesta del próximo mantenimiento', () {
    Future<void> abrirFormulario(WidgetTester tester) async {
      final boton = find.byKey(const Key('boton-programar-mantenimiento'));
      await tester.ensureVisible(boton);
      await tester.pumpAndSettle();
      await tester.tap(boton);
      await tester.pumpAndSettle();
    }

    testWidgets('usar_propuesta_rellena_la_fecha_y_el_kilometraje_y_se_pueden_corregir', (tester) async {
      final api = await abrirOrden(tester, estado: 'TERMINADO');
      api.propuesta = [
        {'serviceTypeId': 1, 'serviceType': 'Cambio de aceite', 'nextDate': '2027-05-24', 'nextMileage': 45000},
      ];
      await abrirFormulario(tester);
      await tester.tap(find.byKey(const Key('usar-propuesta')));
      await tester.pumpAndSettle();
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-proxima-fecha'))).controller!.text, '2027-05-24');
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-proximo-km'))).controller!.text, '45000');
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-tipo-servicio'))).controller!.text, 'Cambio de aceite');
      await tester.enterText(find.byKey(const Key('campo-proximo-km')), '46000');
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-proximo-km'))).controller!.text, '46000');
    });

    testWidgets('sin_tipos_con_intervalo_avisa_que_no_hay_propuesta', (tester) async {
      final api = await abrirOrden(tester, estado: 'TERMINADO');
      api.propuesta = [];
      await abrirFormulario(tester);
      await tester.tap(find.byKey(const Key('usar-propuesta')));
      await tester.pumpAndSettle();
      expect(find.text('La orden no tiene servicios con un tipo que tenga intervalo.'), findsOneWidget);
    });
  });
}
