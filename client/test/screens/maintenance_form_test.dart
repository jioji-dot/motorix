import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/test_app.dart';

Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

/// Abre el formulario desde la sección Mantenimientos (sin orden de origen).
Future<ApiInventario> abrirFormulario(WidgetTester tester, {String rol = 'MECHANIC'}) async {
  final api = ApiInventario(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Mantenimientos').first);
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, 'Programar mantenimiento').first);
  await tester.pumpAndSettle();
  return api;
}

/// Abre el formulario desde una orden terminada.
Future<ApiInventario> abrirDesdeOrdenTerminada(WidgetTester tester, {String rol = 'MECHANIC', String estado = 'TERMINADO'}) async {
  final orden = ordenJson(7, estado: estado, mechanicId: 1);
  orden['serviceMileage'] = 45320;
  (orden['history'] as List).add({
    'fromStatus': 'EN_REPARACION',
    'toStatus': 'TERMINADO',
    'changedBy': {'id': 3, 'name': 'Mario Mecánico'},
    'reason': null,
    'changedAt': '2026-10-05T16:30:00.000',
  });
  final api = ApiInventario(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [orden],
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
  group('Programar desde una orden terminada', () {
    testWidgets('el_boton_precarga_el_vehiculo_la_fecha_y_el_kilometraje_del_servicio', (tester) async {
      await abrirDesdeOrdenTerminada(tester);

      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      expect(find.text('Programar mantenimiento'), findsWidgets);
      expect(find.descendant(of: find.byKey(const Key('vehiculo-fijo')), matching: find.textContaining('ABC-123-A')), findsOneWidget);
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-fecha-ultimo'))).controller!.text, '2026-10-05');
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-km-ultimo'))).controller!.text, '45320');
    });

    testWidgets('guarda_con_la_orden_de_origen_y_los_valores_capturados', (tester) async {
      final api = await abrirDesdeOrdenTerminada(tester);
      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-tipo-servicio')), 'Cambio de aceite');
      await tester.enterText(find.byKey(const Key('campo-proxima-fecha')), '2027-04-05');
      await tester.enterText(find.byKey(const Key('campo-proximo-km')), '50320');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('POST', '/api/maintenance').single.body) as Map<String, dynamic>;
      expect(envio, containsPair('vehicleId', 1));
      expect(envio, containsPair('serviceType', 'Cambio de aceite'));
      expect(envio, containsPair('lastServiceDate', '2026-10-05'));
      expect(envio, containsPair('lastMileage', 45320));
      expect(envio, containsPair('nextDate', '2027-04-05'));
      expect(envio, containsPair('nextMileage', 50320));
      expect(envio, containsPair('sourceOrderId', 7));
      expect(find.text('Mantenimiento programado correctamente.'), findsOneWidget);
    });

    testWidgets('recepcion_no_ve_el_boton_de_programar', (tester) async {
      await abrirDesdeOrdenTerminada(tester, rol: 'RECEPTIONIST');
      expect(find.byKey(const Key('boton-programar-mantenimiento')), findsNothing);
    });

    testWidgets('una_orden_en_curso_no_ofrece_programar_mantenimiento', (tester) async {
      await abrirDesdeOrdenTerminada(tester, estado: 'EN_REPARACION');
      expect(find.byKey(const Key('boton-programar-mantenimiento')), findsNothing);
    });

    testWidgets('tambien_se_ofrece_en_una_orden_entregada', (tester) async {
      await abrirDesdeOrdenTerminada(tester, estado: 'ENTREGADO');
      expect(find.byKey(const Key('boton-programar-mantenimiento')), findsOneWidget);
    });
  });

  group('Validaciones del formulario', () {
    testWidgets('exige_el_cliente_el_vehiculo_el_tipo_de_servicio_y_los_datos_del_ultimo_servicio', (tester) async {
      final api = await abrirFormulario(tester);

      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El cliente es obligatorio.'), findsOneWidget);
      expect(find.text('El tipo de servicio es obligatorio.'), findsOneWidget);
      expect(find.text('La fecha del último servicio es obligatoria.'), findsOneWidget);
      expect(find.text('El kilometraje del último servicio es obligatorio.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/maintenance'), isEmpty);
    });

    testWidgets('sin_proxima_fecha_ni_proximo_kilometraje_se_rechaza_con_un_mensaje_claro', (tester) async {
      final api = await abrirDesdeOrdenTerminada(tester);
      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-tipo-servicio')), 'Frenos');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Indica la próxima fecha, el próximo kilometraje o ambos.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/maintenance'), isEmpty);
    });

    testWidgets('la_proxima_fecha_no_puede_ser_anterior_y_el_proximo_kilometraje_debe_ser_mayor', (tester) async {
      final api = await abrirDesdeOrdenTerminada(tester);
      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-tipo-servicio')), 'Frenos');
      await tester.enterText(find.byKey(const Key('campo-proxima-fecha')), '2026-10-01');
      await tester.enterText(find.byKey(const Key('campo-proximo-km')), '45320');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('La próxima fecha no puede ser anterior a la del último servicio.'), findsOneWidget);
      expect(find.textContaining('El próximo kilometraje debe ser mayor al del último servicio'), findsOneWidget);
      expect(api.enviadas('POST', '/api/maintenance'), isEmpty);
    });

    testWidgets('rechaza_fechas_con_formato_invalido_o_inexistentes', (tester) async {
      await abrirDesdeOrdenTerminada(tester);
      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-tipo-servicio')), 'Frenos');
      await tester.enterText(find.byKey(const Key('campo-proxima-fecha')), '2027-02-31');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('La próxima fecha debe tener el formato AAAA-MM-DD.'), findsOneWidget);
    });

    testWidgets('muestra_el_mensaje_de_la_api_si_el_servidor_rechaza_los_datos', (tester) async {
      final api = await abrirDesdeOrdenTerminada(tester);
      api.sobrescribir = (p) => (p.url.path == '/api/maintenance' && p.method == 'POST')
          ? jsonResponse(400, {
              'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Revisa los datos enviados.',
                'details': [
                  {'field': 'nextMileage', 'message': 'El próximo kilometraje debe ser mayor al del último servicio.'},
                ],
              },
            })
          : null;
      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-tipo-servicio')), 'Frenos');
      await tester.enterText(find.byKey(const Key('campo-proximo-km')), '50000');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('error-formulario')), findsOneWidget);
      expect(find.text('El próximo kilometraje debe ser mayor al del último servicio.'), findsOneWidget);
    });

    testWidgets('salir_con_cambios_pide_confirmacion', (tester) async {
      await abrirDesdeOrdenTerminada(tester);
      await tocarVisible(tester, find.byKey(const Key('boton-programar-mantenimiento')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('campo-tipo-servicio')), 'Algo');
      await tester.pump();
      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Salir sin guardar'), findsOneWidget);
    });
  });
}
