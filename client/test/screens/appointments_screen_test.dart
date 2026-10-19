import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/test_app.dart';

Future<void> irACitas(WidgetTester tester) async {
  await entrar(tester);
  await tester.tap(find.byTooltip('Citas').first);
  await tester.pumpAndSettle();
}

ApiTaller apiConDatos({String rol = 'RECEPTIONIST', List<Map<String, dynamic>>? citas}) => ApiTaller(
      rol: rol,
      clientes: [clienteJson(1, 'Roberto Hernández'), clienteJson(2, 'María López', telefono: '5598765432')],
      vehiculos: [vehiculoJson(1, 1, 'ABC-123-A'), vehiculoJson(2, 2, 'DEF-456-B', propietario: 'María López')],
      citas: citas,
    );

void main() {
  group('Acceso a la sección Citas', () {
    testWidgets('el_mecanico_no_ve_la_seccion_citas', (tester) async {
      await bombearApp(tester, apiConDatos(rol: 'MECHANIC').call);
      await entrar(tester);
      expect(find.byTooltip('Citas'), findsNothing);
    });

    testWidgets('recepcion_y_administrador_si_ven_la_seccion_citas', (tester) async {
      await bombearApp(tester, apiConDatos(rol: 'ADMIN').call);
      await entrar(tester);
      expect(find.byTooltip('Citas'), findsWidgets);
    });
  });

  group('Agenda de citas', () {
    testWidgets('muestra_las_citas_con_cliente_placas_y_estado', (tester) async {
      final api = apiConDatos(citas: [
        citaJson(1, estado: 'PENDIENTE', motivo: 'Cambio de aceite'),
        citaJson(2, clientId: 2, vehicleId: 2, estado: 'CONFIRMADA', cliente: 'María López', placas: 'DEF-456-B', motivo: 'Frenos'),
      ]);
      await bombearApp(tester, api.call);
      await irACitas(tester);

      expect(find.text('Cambio de aceite'), findsOneWidget);
      expect(find.text('Frenos'), findsOneWidget);
      expect(find.text('Roberto Hernández'), findsWidgets);
      expect(find.text('ABC-123-A'), findsWidgets);
      expect(find.text('Pendiente'), findsWidgets);
      expect(find.text('Confirmada'), findsWidgets);
      expect(find.text('15/01/2030 10:00'), findsWidgets);
    });

    testWidgets('muestra_el_estado_vacio_con_la_accion_de_registrar', (tester) async {
      await bombearApp(tester, apiConDatos().call);
      await irACitas(tester);

      expect(find.text('Aún no hay citas'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Registrar cita'), findsWidgets);
    });

    testWidgets('muestra_el_error_de_la_api_con_reintentar', (tester) async {
      final api = apiConDatos();
      api.sobrescribir = (p) => p.url.path == '/api/appointments' && p.method == 'GET'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await irACitas(tester);

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('el_filtro_de_estado_y_la_busqueda_se_envian_a_la_api', (tester) async {
      final api = apiConDatos(citas: [citaJson(1), citaJson(2, estado: 'CONFIRMADA', motivo: 'Frenos')]);
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await tester.tap(find.byKey(const Key('filtro-estado-cita')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmadas').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'rober');
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pumpAndSettle();

      final consultas = api.enviadas('GET', '/api/appointments').map((p) => p.url.queryParameters);
      expect(consultas.any((q) => q['status'] == 'CONFIRMADA'), isTrue);
      expect(consultas.any((q) => q['search'] == 'rober'), isTrue);
    });
  });

  group('Formulario de cita', () {
    Future<void> abrirFormulario(WidgetTester tester) async {
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar cita').first);
      await tester.pumpAndSettle();
    }

    Future<void> elegirCliente(WidgetTester tester, String nombre) async {
      await tester.tap(find.byKey(const Key('campo-cliente')));
      await tester.pumpAndSettle();
      await tester.tap(find.text(nombre).last);
      await tester.pumpAndSettle();
    }

    testWidgets('exige_cliente_vehiculo_y_motivo_en_espanol', (tester) async {
      final api = apiConDatos();
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await abrirFormulario(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El cliente es obligatorio.'), findsOneWidget);
      expect(find.text('El vehículo es obligatorio.'), findsOneWidget);
      expect(find.text('El motivo es obligatorio.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/appointments'), isEmpty);
    });

    testWidgets('registra_la_cita_eligiendo_cliente_y_vehiculo_del_cliente', (tester) async {
      final api = apiConDatos();
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await abrirFormulario(tester);
      await elegirCliente(tester, 'María López');
      await tester.enterText(find.byKey(const Key('campo-motivo')), 'Revisión de frenos');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/appointments').single.body) as Map<String, dynamic>;
      expect(alta['clientId'], 2);
      expect(alta['vehicleId'], 2); // único vehículo del cliente: se preselecciona
      expect(alta['reason'], 'Revisión de frenos');
      expect(alta['scheduledAt'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$')));
      expect(find.text('Cita registrada correctamente.'), findsOneWidget);
      expect(find.text('Revisión de frenos'), findsOneWidget);
    });

    testWidgets('pide_confirmacion_si_hay_una_cita_duplicada_y_reenvia_confirmado', (tester) async {
      final api = apiConDatos();
      var intentos = 0;
      api.sobrescribir = (p) {
        if (p.method == 'POST' && p.url.path == '/api/appointments') {
          intentos++;
          final cuerpo = jsonDecode(p.body) as Map<String, dynamic>;
          if (cuerpo['confirmDuplicate'] != true) {
            return jsonResponse(409, {
              'error': {
                'code': 'DUPLICATE_APPOINTMENT',
                'message': 'Ya hay una cita activa de este vehículo a esa fecha y hora.',
                'details': [
                  {'id': 9, 'scheduledAt': '2030-01-15T10:00:00.000Z', 'status': 'CONFIRMADA'},
                ],
              },
            });
          }
        }
        return null;
      };
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await abrirFormulario(tester);
      await elegirCliente(tester, 'Roberto Hernández');
      await tester.enterText(find.byKey(const Key('campo-motivo')), 'Afinación');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Cita duplicada'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(intentos, 2);
      expect(find.text('Cita registrada correctamente.'), findsOneWidget);
    });

    testWidgets('muestra_el_mensaje_de_la_api_cuando_la_fecha_es_pasada', (tester) async {
      final api = apiConDatos();
      api.sobrescribir = (p) => p.method == 'POST' && p.url.path == '/api/appointments'
          ? jsonResponse(400, {
              'error': {
                'code': 'VALIDATION_ERROR',
                'message': 'Revisa los datos enviados.',
                'details': [
                  {'field': 'scheduledAt', 'message': 'La fecha y hora de la cita no pueden estar en el pasado.'},
                ],
              },
            })
          : null;
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await abrirFormulario(tester);
      await elegirCliente(tester, 'Roberto Hernández');
      await tester.enterText(find.byKey(const Key('campo-motivo')), 'Afinación');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('La fecha y hora de la cita no pueden estar en el pasado.'), findsOneWidget);
    });

    testWidgets('pide_confirmacion_al_salir_con_cambios_sin_guardar', (tester) async {
      await bombearApp(tester, apiConDatos().call);
      await irACitas(tester);

      await abrirFormulario(tester);
      await tester.enterText(find.byKey(const Key('campo-motivo')), 'Algo');
      await tester.pump();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Salir sin guardar'), findsOneWidget);
    });
  });

  group('Detalle de la cita', () {
    testWidgets('confirma_una_cita_pendiente', (tester) async {
      final api = apiConDatos(citas: [citaJson(1)]);
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await tester.tap(find.text('Revisión general'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Confirmar cita'));
      await tester.pumpAndSettle();

      expect(api.enviadas('POST', '/api/appointments/1/confirm'), hasLength(1));
      expect(find.text('Cita confirmada.'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Confirmar cita'), findsNothing);
    });

    testWidgets('cancelar_pide_confirmacion_y_conserva_la_cita_si_se_arrepiente', (tester) async {
      final api = apiConDatos(citas: [citaJson(1, estado: 'CONFIRMADA')]);
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await tester.tap(find.text('Revisión general'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar cita'));
      await tester.pumpAndSettle();
      expect(find.text('Confirmar'), findsOneWidget);
      await tester.tap(find.text('Cancelar').last);
      await tester.pumpAndSettle();
      expect(api.enviadas('POST', '/api/appointments/1/cancel'), isEmpty);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar cita'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('POST', '/api/appointments/1/cancel'), hasLength(1));
      expect(find.text('Cita cancelada.'), findsOneWidget);
    });

    testWidgets('una_cita_con_orden_no_ofrece_cancelar_y_explica_por_que', (tester) async {
      final api = apiConDatos(citas: [citaJson(1, estado: 'EN_PROCESO', orderId: 7)]);
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await tester.tap(find.text('Revisión general'));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Cancelar cita'), findsNothing);
      expect(find.textContaining('orden de servicio activa'), findsOneWidget);
    });

    testWidgets('las_citas_canceladas_o_completadas_son_de_solo_lectura', (tester) async {
      final api = apiConDatos(citas: [citaJson(1, estado: 'CANCELADA')]);
      await bombearApp(tester, api.call);
      await irACitas(tester);

      await tester.tap(find.text('Revisión general'));
      await tester.pumpAndSettle();

      expect(find.text('Editar'), findsNothing);
      expect(find.text('Confirmar cita'), findsNothing);
      expect(find.text('Cancelar cita'), findsNothing);
    });
  });
}
