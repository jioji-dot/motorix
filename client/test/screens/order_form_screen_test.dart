import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:motorix_client/models/appointment.dart';
import 'package:motorix_client/providers/appointments_provider.dart';
import 'package:motorix_client/providers/clients_provider.dart';
import 'package:motorix_client/providers/orders_provider.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/screens/order_form_screen.dart';
import 'package:motorix_client/services/api_client.dart';
import 'package:motorix_client/utils/app_theme.dart';
import 'package:provider/provider.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/test_app.dart';

/// Abre el formulario de orden dentro de una ruta, con los providers que necesita.
Future<void> abrirFormulario(WidgetTester tester, ApiTaller api, {Widget Function()? formulario}) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final cliente = ApiClient(client: MockClient(api.call), baseUrl: 'http://prueba/api')..token = 'token';
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: cliente),
        ChangeNotifierProvider(create: (_) => ClientsProvider(cliente)),
        ChangeNotifierProvider(create: (_) => VehiclesProvider(cliente)),
        ChangeNotifierProvider(create: (_) => OrdersProvider(cliente)),
        ChangeNotifierProvider(create: (_) => AppointmentsProvider(cliente)),
      ],
      child: MaterialApp(
        theme: buildAppTheme(useGoogleFonts: false),
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => formulario?.call() ?? const OrderFormScreen()),
                ),
                child: const Text('abrir'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

ApiTaller apiConDatos() => ApiTaller(
      rol: 'RECEPTIONIST',
      clientes: [clienteJson(1, 'Roberto Hernández'), clienteJson(2, 'María López', telefono: '5598765432')],
      vehiculos: [
        vehiculoJson(1, 1, 'ABC-123-A', km: 45000),
        vehiculoJson(2, 2, 'DEF-456-B', propietario: 'María López', km: 80000),
      ],
      citas: [citaJson(5, estado: 'CONFIRMADA', motivo: 'Revisión de frenos')],
    );

Future<void> elegirCliente(WidgetTester tester, String nombre) async {
  await tester.tap(find.byKey(const Key('campo-cliente')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(nombre).last);
  await tester.pumpAndSettle();
}

Future<void> elegirMecanico(WidgetTester tester, String nombre) async {
  await tester.tap(find.byKey(const Key('campo-mecanico')));
  await tester.pumpAndSettle();
  await tester.tap(find.text(nombre).last);
  await tester.pumpAndSettle();
}

void main() {
  group('Formulario de orden', () {
    testWidgets('exige_cliente_vehiculo_mecanico_kilometraje_y_problema_en_espanol', (tester) async {
      final api = apiConDatos();
      await abrirFormulario(tester, api);

      await tester.tap(find.widgetWithText(FilledButton, 'Crear orden'));
      await tester.pumpAndSettle();

      expect(find.text('El cliente es obligatorio.'), findsOneWidget);
      expect(find.text('El vehículo es obligatorio.'), findsOneWidget);
      expect(find.text('El mecánico es obligatorio.'), findsOneWidget);
      expect(find.text('El kilometraje de entrada es obligatorio.'), findsOneWidget);
      expect(find.text('El problema reportado es obligatorio.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/orders'), isEmpty);
    });

    testWidgets('valida_que_el_kilometraje_este_entre_0_y_1500000', (tester) async {
      await abrirFormulario(tester, apiConDatos());

      for (final valor in ['-5', '1500001', '12.5']) {
        await tester.enterText(find.byKey(const Key('campo-kilometraje-entrada')), valor);
        await tester.tap(find.widgetWithText(FilledButton, 'Crear orden'));
        await tester.pumpAndSettle();
        expect(
          find.text('El kilometraje de entrada debe ser un número entero entre 0 y 1,500,000 km.'),
          findsOneWidget,
          reason: 'valor $valor',
        );
      }
    });

    testWidgets('crea_la_orden_con_cliente_vehiculo_mecanico_kilometraje_y_problema', (tester) async {
      final api = apiConDatos();
      await abrirFormulario(tester, api);

      await elegirCliente(tester, 'Roberto Hernández');
      await elegirMecanico(tester, 'Ana Mecánica');
      await tester.enterText(find.byKey(const Key('campo-kilometraje-entrada')), '46000');
      await tester.enterText(find.byKey(const Key('campo-problema')), 'Ruido al frenar');
      await tester.tap(find.widgetWithText(FilledButton, 'Crear orden'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/orders').single.body) as Map<String, dynamic>;
      expect(alta['clientId'], 1);
      expect(alta['vehicleId'], 1); // único vehículo del cliente: se preselecciona
      expect(alta['mechanicId'], 4);
      expect(alta['entryMileage'], 46000);
      expect(alta['reportedProblem'], 'Ruido al frenar');
      expect(alta.containsKey('appointmentId'), isFalse);
      expect(find.textContaining('Orden OS-000100 creada correctamente.'), findsOneWidget);
    });

    testWidgets('muestra_el_kilometraje_actual_del_vehiculo_elegido', (tester) async {
      await abrirFormulario(tester, apiConDatos());

      await elegirCliente(tester, 'María López');

      expect(find.textContaining('80,000 km'), findsOneWidget);
    });

    testWidgets('pide_confirmar_la_correccion_si_el_kilometraje_es_menor_y_reenvia', (tester) async {
      final api = apiConDatos();
      api.sobrescribir = (p) {
        if (p.method == 'POST' && p.url.path == '/api/orders') {
          final cuerpo = jsonDecode(p.body) as Map<String, dynamic>;
          if (cuerpo['mileageCorrection'] != true) {
            return jsonResponse(409, {
              'error': {
                'code': 'MILEAGE_DECREASE',
                'message': 'El kilometraje de entrada no puede ser menor al registrado en el vehículo (45000 km).',
              },
            });
          }
        }
        return null;
      };
      await abrirFormulario(tester, api);

      await elegirCliente(tester, 'Roberto Hernández');
      await elegirMecanico(tester, 'Mario Mecánico');
      await tester.enterText(find.byKey(const Key('campo-kilometraje-entrada')), '30000');
      await tester.enterText(find.byKey(const Key('campo-problema')), 'Revisión');
      await tester.tap(find.widgetWithText(FilledButton, 'Crear orden'));
      await tester.pumpAndSettle();

      expect(find.text('Corregir kilometraje'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      final envios = api.enviadas('POST', '/api/orders');
      expect(envios, hasLength(2));
      expect(jsonDecode(envios.last.body), containsPair('mileageCorrection', true));
      expect(find.textContaining('creada correctamente'), findsOneWidget);
    });

    testWidgets('pide_confirmacion_al_salir_con_cambios_sin_guardar', (tester) async {
      await abrirFormulario(tester, apiConDatos());

      await tester.enterText(find.byKey(const Key('campo-problema')), 'Algo');
      await tester.pump();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Salir sin guardar'), findsOneWidget);
    });
  });

  group('Desde una cita', () {
    testWidgets('llega_prellenado_con_el_cliente_el_vehiculo_y_el_motivo_y_envia_el_appointmentId', (tester) async {
      final api = apiConDatos();
      final cita = Appointment.fromJson(api.citas.first);
      await abrirFormulario(tester, api, formulario: () => OrderFormScreen(appointment: cita));

      // Cliente y vehículo vienen de la cita y no se pueden cambiar; el problema toma el motivo.
      expect(tester.widget<TextFormField>(find.byKey(const Key('campo-cliente'))).enabled, isFalse);
      expect(find.text('Revisión de frenos'), findsOneWidget);

      await elegirMecanico(tester, 'Mario Mecánico');
      await tester.enterText(find.byKey(const Key('campo-kilometraje-entrada')), '45500');
      await tester.tap(find.widgetWithText(FilledButton, 'Crear orden'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/orders').single.body) as Map<String, dynamic>;
      expect(alta['appointmentId'], 5);
      expect(alta['clientId'], 1);
      expect(alta['vehicleId'], 1);
      expect(alta['reportedProblem'], 'Revisión de frenos');
      expect(api.citas.first['status'], 'EN_PROCESO');
    });
  });
}
