import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/test_app.dart';

Future<void> irAVehiculos(WidgetTester tester) async {
  await entrar(tester);
  await tester.tap(find.text('Vehículos').first);
  await tester.pumpAndSettle();
}

Future<void> llenarVehiculo(
  WidgetTester tester, {
  String marca = 'Kia',
  String modelo = 'Rio',
  String anio = '2021',
  String placas = 'kia-001',
  String km = '12000',
}) async {
  await tester.enterText(find.byKey(const Key('campo-marca')), marca);
  await tester.enterText(find.byKey(const Key('campo-modelo')), modelo);
  await tester.enterText(find.byKey(const Key('campo-anio')), anio);
  await tester.enterText(find.byKey(const Key('campo-placas')), placas);
  await tester.enterText(find.byKey(const Key('campo-kilometraje')), km);
}

void main() {
  final roberto = clienteJson(1, 'Roberto Hernández');

  group('Lista de vehículos', () {
    testWidgets('muestra_los_vehiculos_con_placas_y_propietario', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto], vehiculos: [
        vehiculoJson(1, 1, 'ABC-123-A'),
        vehiculoJson(2, 1, 'DEF-456-B', marca: 'Volkswagen', modelo: 'Jetta', km: 96500),
      ]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      expect(find.text('ABC-123-A'), findsOneWidget);
      expect(find.text('DEF-456-B'), findsOneWidget);
      expect(find.text('Roberto Hernández'), findsWidgets);
      expect(find.text('96,500 km'), findsOneWidget);
    });

    testWidgets('muestra_el_estado_vacio_con_la_accion_de_registrar', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto]).call);
      await irAVehiculos(tester);

      expect(find.text('Aún no hay vehículos'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Registrar vehículo'), findsWidgets);
    });

    testWidgets('el_mecanico_consulta_pero_no_ve_el_boton_de_registrar', (tester) async {
      final api = ApiSimulada(rol: 'MECHANIC', clientes: [roberto], vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      expect(find.text('ABC-123-A'), findsOneWidget);
      expect(find.text('Registrar vehículo'), findsNothing);
      expect(find.byTooltip('Editar'), findsNothing);
    });

    testWidgets('envia_el_texto_de_busqueda_a_la_api', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto], vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'abc');
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pumpAndSettle();

      final busquedas = api.enviadas('GET', '/api/vehicles').map((p) => p.url.queryParameters['search']);
      expect(busquedas, contains('abc'));
    });
  });

  group('Formulario de vehículo', () {
    testWidgets('exige_el_propietario_y_no_envia_nada_si_falta', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar vehículo').first);
      await tester.pumpAndSettle();
      await llenarVehiculo(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El propietario es obligatorio.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/vehicles'), isEmpty);
    });

    testWidgets('valida_marca_anio_y_kilometraje_en_espanol', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto]).call);
      await irAVehiculos(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar vehículo').first);
      await tester.pumpAndSettle();
      await llenarVehiculo(tester, marca: '', anio: '1900', km: '-5');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('La marca es obligatoria.'), findsOneWidget);
      expect(find.text('El año debe ser 1950 o posterior.'), findsOneWidget);
      expect(find.text('El kilometraje debe ser un número entero mayor o igual a 0.'), findsOneWidget);
    });

    testWidgets('registra_el_vehiculo_eligiendo_el_propietario_en_el_selector', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto, clienteJson(2, 'María López', telefono: '5598765432')]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar vehículo').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('campo-propietario')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('María López').last);
      await tester.pumpAndSettle();
      await llenarVehiculo(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/vehicles').single.body) as Map<String, dynamic>;
      expect(alta['clientId'], 2);
      expect(alta['licensePlate'], 'KIA-001');
      expect(alta['year'], 2021);
      expect(alta['currentMileage'], 12000);
      expect(find.text('Vehículo registrado correctamente.'), findsOneWidget);
      expect(find.text('KIA-001'), findsOneWidget);
    });

    testWidgets('muestra_el_mensaje_del_servidor_cuando_las_placas_ya_existen', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto]);
      api.sobrescribir = (p) => p.method == 'POST' && p.url.path == '/api/vehicles'
          ? jsonResponse(409, {
              'error': {
                'code': 'DUPLICATE_VALUE',
                'message': 'Ya existe un vehículo con esas placas.',
                'details': [
                  {'field': 'licensePlate', 'message': 'Ya existe un vehículo con esas placas.'},
                ],
              },
            })
          : null;
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar vehículo').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('campo-propietario')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Roberto Hernández').last);
      await tester.pumpAndSettle();
      await llenarVehiculo(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Ya existe un vehículo con esas placas.'), findsOneWidget);
      expect(find.byKey(const Key('campo-placas')), findsOneWidget); // sigue en el formulario
    });

    testWidgets('pide_confirmar_la_correccion_cuando_el_kilometraje_baja_y_reenvia', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto], vehiculos: [vehiculoJson(1, 1, 'ABC-123-A', km: 50000)]);
      api.sobrescribir = (p) {
        if (p.method == 'PATCH' && p.url.path == '/api/vehicles/1') {
          final cuerpo = jsonDecode(p.body) as Map<String, dynamic>;
          if (cuerpo['mileageCorrection'] != true) {
            return jsonResponse(409, {
              'error': {'code': 'MILEAGE_DECREASE', 'message': 'El kilometraje no puede ser menor al registrado (50000 km).'},
            });
          }
        }
        return null;
      };
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.tap(find.byTooltip('Editar').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-kilometraje')), '40000');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Corregir kilometraje'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      final envios = api.enviadas('PATCH', '/api/vehicles/1');
      expect(envios, hasLength(2));
      expect(jsonDecode(envios.last.body), containsPair('mileageCorrection', true));
      expect(find.text('Vehículo actualizado correctamente.'), findsOneWidget);
    });

    testWidgets('en_la_edicion_el_propietario_no_se_puede_cambiar', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto], vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.tap(find.byTooltip('Editar').first);
      await tester.pumpAndSettle();

      final campo = tester.widget<TextFormField>(find.byKey(const Key('campo-propietario')));
      expect(campo.enabled, isFalse);
    });
  });

  group('Desde el detalle del cliente', () {
    testWidgets('registrar_vehiculo_abre_el_formulario_con_el_propietario_ya_elegido', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [roberto]);
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.tap(find.text('Roberto Hernández'));
      await tester.pumpAndSettle();
      expect(find.text('Este cliente aún no tiene vehículos'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar vehículo'));
      await tester.pumpAndSettle();
      await llenarVehiculo(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/vehicles').single.body) as Map<String, dynamic>;
      expect(alta['clientId'], 1);
      expect(find.text('KIA-001'), findsOneWidget); // ya aparece en el detalle del cliente
    });
  });

  group('Detalle de vehículo', () {
    testWidgets('muestra_los_datos_y_el_propietario', (tester) async {
      final api = ApiSimulada(rol: 'MECHANIC', clientes: [roberto], vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')]);
      await bombearApp(tester, api.call);
      await irAVehiculos(tester);

      await tester.tap(find.text('ABC-123-A'));
      await tester.pumpAndSettle();

      expect(find.text('Nissan Versa 2020'), findsWidgets);
      expect(find.text('Propietario'), findsOneWidget);
      expect(find.text('Roberto Hernández'), findsWidgets);
      expect(find.text('Editar'), findsNothing);
    });
  });
}
