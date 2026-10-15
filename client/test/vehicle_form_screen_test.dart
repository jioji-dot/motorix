import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirComoRol(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

Future<void> irAVehiculos(WidgetTester tester) async {
  await tester.tap(find.text('Vehículos'));
  await tester.pumpAndSettle();
}

Finder campo(String etiqueta) => find.widgetWithText(TextFormField, etiqueta);

void main() {
  testWidgets('test_el_listado_muestra_placa_vehiculo_y_propietario', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/vehicles' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[
          vehicleJson(licensePlate: 'AAA111', brand: 'Nissan', model: 'Versa', ownerName: 'Ana Pérez'),
        ]);
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);

    expect(find.text('AAA111'), findsOneWidget);
    expect(find.text('Nissan Versa'), findsOneWidget);
    expect(find.text('Ana Pérez'), findsOneWidget);
  });

  testWidgets('test_el_mecanico_no_ve_acciones_de_alta_de_vehiculos', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC'));
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);

    expect(find.text('Nuevo vehículo'), findsNothing);
    expect(find.text('Registrar el primer vehículo'), findsNothing);
    expect(find.text('Aún no hay vehículos registrados.'), findsOneWidget);
  });

  testWidgets('test_el_propietario_es_obligatorio_para_registrar_un_vehiculo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);
    await tester.tap(find.text('Nuevo vehículo'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Marca *'), 'Toyota');
    await tester.enterText(campo('Modelo *'), 'Corolla');
    await tester.enterText(campo('Año *'), '2021');
    await tester.enterText(campo('Placa *'), 'XYZ987');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Selecciona al propietario del vehículo.'), findsOneWidget);
    expect(api.requests.where((RecordedRequest r) => r.method == 'POST' && r.path == '/vehicles'), isEmpty);
  });

  testWidgets('test_valida_marca_modelo_anio_y_placa', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);
    await tester.tap(find.text('Nuevo vehículo'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Año *'), '1900');
    await tester.enterText(campo('Número de identificación (VIN)'), 'ABC');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ingresa la marca.'), findsOneWidget);
    expect(find.text('Ingresa el modelo.'), findsOneWidget);
    expect(find.textContaining('El año debe estar entre 1950'), findsOneWidget);
    expect(find.text('La placa es obligatoria.'), findsOneWidget);
    expect(find.textContaining('17 caracteres'), findsOneWidget);
  });

  testWidgets('test_registra_un_vehiculo_eligiendo_al_propietario_en_la_busqueda', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/clients' && r.method == 'GET' && r.query['search'] == 'ana') {
        return listOf(<Map<String, dynamic>>[clientJson(id: 7, name: 'Ana Pérez')]);
      }
      if (r.method == 'POST' && r.path == '/vehicles') {
        return jsonData(vehicleJson(clientId: 7), status: 201);
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);
    await tester.tap(find.text('Nuevo vehículo'));
    await tester.pumpAndSettle();

    await tester.enterText(find.widgetWithText(TextField, 'Propietario *'), 'ana');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Marca *'), 'Toyota');
    await tester.enterText(campo('Modelo *'), 'Corolla');
    await tester.enterText(campo('Año *'), '2021');
    await tester.enterText(campo('Placa *'), 'xyz-987');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest alta =
        api.requests.firstWhere((RecordedRequest r) => r.method == 'POST' && r.path == '/vehicles');
    expect(alta.body!['clientId'], 7);
    expect(alta.body!['licensePlate'], 'xyz-987');
    expect(alta.body!['year'], 2021);
    expect(find.text('Vehículo registrado correctamente.'), findsOneWidget);
  });

  testWidgets('test_muestra_el_error_de_placa_duplicada_junto_al_campo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/clients' && r.method == 'GET' && r.query['search'] == 'ana') {
        return listOf(<Map<String, dynamic>>[clientJson(id: 7, name: 'Ana Pérez')]);
      }
      if (r.method == 'POST' && r.path == '/vehicles') {
        return jsonError(409, 'DUPLICATE_LICENSE_PLATE', 'Ya existe un vehículo con esa placa.',
            details: <String, dynamic>{'field': 'licensePlate'});
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);
    await tester.tap(find.text('Nuevo vehículo'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'Propietario *'), 'ana');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();
    await tester.enterText(campo('Marca *'), 'Toyota');
    await tester.enterText(campo('Modelo *'), 'Corolla');
    await tester.enterText(campo('Año *'), '2021');
    await tester.enterText(campo('Placa *'), 'XYZ987');

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ya existe un vehículo con esa placa.'), findsOneWidget);
    expect(find.text('Vehículo registrado correctamente.'), findsNothing);
  });

  testWidgets('test_pide_confirmar_la_correccion_cuando_el_kilometraje_baja', (WidgetTester tester) async {
    int ediciones = 0;
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/vehicles' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[
          vehicleJson(id: 5, licensePlate: 'AAA111', currentMileage: 50000, ownerName: 'Ana Pérez'),
        ]);
      }
      if (r.path == '/vehicles/5' && r.method == 'GET') {
        return jsonData(<String, dynamic>{
          ...vehicleJson(id: 5, licensePlate: 'AAA111', currentMileage: 50000),
          'owner': <String, dynamic>{'id': 1, 'name': 'Ana Pérez', 'phone': '5512345678'},
        });
      }
      if (r.method == 'PATCH' && r.path == '/vehicles/5') {
        ediciones++;
        return jsonData(vehicleJson(id: 5, currentMileage: 40000));
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);
    await tester.tap(find.text('AAA111'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Kilometraje actual'), '40000');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Kilometraje menor al registrado'), findsOneWidget);
    expect(ediciones, 0, reason: 'no debía llamar al servidor antes de confirmar');

    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(ediciones, 1);
    final RecordedRequest patch = api.requests.firstWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(patch.body!['mileageCorrection'], isTrue);
    expect(patch.body!.containsKey('clientId'), isFalse);
  });

  testWidgets('test_el_propietario_no_se_puede_cambiar_al_editar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/vehicles' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[vehicleJson(id: 5, ownerName: 'Ana Pérez')]);
      }
      if (r.path == '/vehicles/5' && r.method == 'GET') {
        return jsonData(<String, dynamic>{
          ...vehicleJson(id: 5),
          'owner': <String, dynamic>{'id': 1, 'name': 'Ana Pérez', 'phone': '5512345678'},
        });
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await irAVehiculos(tester);
    await tester.tap(find.text('ABC123'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Ana Pérez · 5512345678'), findsOneWidget);
    expect(find.text('Cambiar'), findsNothing);
  });
}
