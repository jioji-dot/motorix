import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Map<String, dynamic> entradaJson({
  int orderId = 12,
  String folio = 'OS-000012',
  String status = 'ENTREGADO',
  String serviceDate = '2026-09-30T16:20:00.000Z',
  int mileage = 20450,
  String? mechanicName = 'Mario Mecánico',
  String reportedProblem = 'Ruido al frenar',
  String? diagnosis = 'Balatas gastadas',
  String? recommendations = 'Revisar llantas en 5,000 km',
  List<Map<String, dynamic>> services = const <Map<String, dynamic>>[],
  List<Map<String, dynamic>> labor = const <Map<String, dynamic>>[],
  List<Map<String, dynamic>> parts = const <Map<String, dynamic>>[],
  double total = 0,
}) =>
    <String, dynamic>{
      'orderId': orderId,
      'folio': folio,
      'status': status,
      'serviceDate': serviceDate,
      'mileage': mileage,
      'mechanicName': mechanicName,
      'reportedProblem': reportedProblem,
      'diagnosis': diagnosis,
      'recommendations': recommendations,
      'services': services,
      'labor': labor,
      'parts': parts,
      'total': total,
    };

Future<void> abrirVehiculo(WidgetTester tester, FakeApi api, {String usuario = 'mecanico'}) async {
  tester.view.physicalSize = const Size(1400, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Vehículos'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('ABC123'));
  await tester.pumpAndSettle();
}

FakeHandler handler({
  String role = 'MECHANIC',
  required http.Response Function(RecordedRequest) historial,
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        if (r.path == '/vehicles' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[
            vehicleJson(id: 1, licensePlate: 'ABC123', ownerName: 'Ana Pérez'),
          ]);
        }
        if (r.path == '/vehicles/1' && r.method == 'GET') {
          return jsonData(<String, dynamic>{
            ...vehicleJson(id: 1, licensePlate: 'ABC123'),
            'owner': <String, dynamic>{'id': 1, 'name': 'Ana Pérez', 'phone': '5512345678'},
          });
        }
        if (r.path == '/vehicles/1/history') return historial(r);
        return null;
      },
    );

void main() {
  testWidgets('test_muestra_el_historial_en_el_orden_recibido_con_kilometraje_y_mecanico', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      historial: (RecordedRequest r) => listOf(<Map<String, dynamic>>[
        entradaJson(orderId: 12, folio: 'OS-000012', mileage: 20450, total: 1570),
        entradaJson(orderId: 7, folio: 'OS-000007', status: 'TERMINADO', mileage: 15000, mechanicName: null, total: 300),
      ]),
    ));
    await abrirVehiculo(tester, api);

    expect(find.text('Historial de servicios'), findsOneWidget);
    expect(find.text('OS-000012'), findsOneWidget);
    expect(find.text('OS-000007'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('OS-000012')).dy < tester.getTopLeft(find.text('OS-000007')).dy,
      isTrue,
      reason: 'el servicio más reciente debe mostrarse primero',
    );
    expect(find.text('20,450 km'), findsOneWidget);
    expect(find.text('Mario Mecánico'), findsOneWidget);
    expect(find.text('Sin mecánico asignado'), findsOneWidget);
    expect(find.text('Entregado'), findsOneWidget);
    expect(find.text('Terminado'), findsOneWidget);
    expect(find.text('Balatas gastadas'), findsWidgets);
  });

  testWidgets('test_el_detalle_del_servicio_muestra_servicios_mano_de_obra_y_refacciones', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      historial: (RecordedRequest r) => listOf(<Map<String, dynamic>>[
        entradaJson(
          services: <Map<String, dynamic>>[
            <String, dynamic>{'description': 'Cambio de aceite', 'amount': 850},
          ],
          labor: <Map<String, dynamic>>[
            <String, dynamic>{'description': 'Servicio completo', 'hours': 2, 'hourlyRate': 300, 'amount': 600},
          ],
          parts: <Map<String, dynamic>>[
            <String, dynamic>{'code': 'FIL-01', 'name': 'Filtro de aceite', 'quantity': 1, 'unitPrice': 120, 'amount': 120},
          ],
          total: 1570,
        ),
      ]),
    ));
    await abrirVehiculo(tester, api);

    expect(find.text('Cambio de aceite'), findsNothing);
    await tester.tap(find.text('Ver detalle del servicio'));
    await tester.pumpAndSettle();

    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('Servicio completo'), findsOneWidget);
    expect(find.text('FIL-01 · Filtro de aceite'), findsOneWidget);
    expect(find.text('2 h × \$300'), findsOneWidget);
    expect(find.text('1 × \$120.00'), findsOneWidget);
    expect(find.textContaining('1,570.00'), findsWidgets);
  });

  testWidgets('test_sin_servicios_muestra_el_mensaje_de_vacio', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(historial: (RecordedRequest r) => emptyList()));
    await abrirVehiculo(tester, api);

    expect(find.text('Este vehículo aún no tiene servicios registrados.'), findsOneWidget);
  });

  testWidgets('test_un_error_del_historial_se_muestra_con_reintento_sin_romper_el_detalle', (WidgetTester tester) async {
    int llamadas = 0;
    final FakeApi api = FakeApi(handler(
      historial: (RecordedRequest r) {
        llamadas++;
        return llamadas == 1
            ? jsonError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
            : listOf(<Map<String, dynamic>>[entradaJson()]);
      },
    ));
    await abrirVehiculo(tester, api);

    expect(find.text('Ocurrió un error inesperado. Inténtalo de nuevo.'), findsOneWidget);
    expect(find.text('Detalle del vehículo'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();

    expect(find.text('OS-000012'), findsOneWidget);
  });

  testWidgets('test_pagina_el_historial', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      historial: (RecordedRequest r) => listOf(
        <Map<String, dynamic>>[
          entradaJson(orderId: r.query['page'] == '2' ? 3 : 12, folio: r.query['page'] == '2' ? 'OS-000003' : 'OS-000012'),
        ],
        total: 25,
        page: int.parse(r.query['page'] ?? '1'),
        pageSize: 20,
      ),
    ));
    await abrirVehiculo(tester, api);
    expect(find.text('OS-000012'), findsOneWidget);

    await tester.tap(find.byTooltip('Página siguiente'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/vehicles/1/history' && r.query['page'] == '2'), isTrue);
  });

  testWidgets('test_el_historial_es_de_solo_lectura_para_cualquier_rol', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      role: 'ADMIN',
      historial: (RecordedRequest r) => listOf(<Map<String, dynamic>>[entradaJson()]),
    ));
    await abrirVehiculo(tester, api, usuario: 'admin');

    expect(find.text('OS-000012'), findsOneWidget);
    expect(find.byTooltip('Editar'), findsNothing);
    expect(find.text('Agregar servicio'), findsNothing);
  });
}
