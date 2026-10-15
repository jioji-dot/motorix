import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirMantenimientos(WidgetTester tester, FakeApi api, {String usuario = 'recepcion'}) async {
  tester.view.physicalSize = const Size(1600, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Mantenimientos'));
  await tester.pumpAndSettle();
}

http.Response listado(List<Map<String, dynamic>> items, {int total = -1}) => jsonData(
      items,
      meta: <String, dynamic>{
        'page': 1,
        'pageSize': 20,
        'total': total < 0 ? items.length : total,
        'warningDays': 30,
        'warningKm': 1000,
      },
    );

FakeHandler handler(
  http.Response Function(RecordedRequest) mantenimientos, {
  String role = 'RECEPTIONIST',
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        if (r.path == '/maintenance' && r.method == 'GET') return mantenimientos(r);
        return null;
      },
    );

final List<Map<String, dynamic>> _muestra = <Map<String, dynamic>>[
  maintenanceJson(
    id: 1,
    clientName: 'Ana Pérez',
    clientPhone: '5512345678',
    vehiclePlate: 'ABC123',
    vehicleTitle: 'Nissan Versa',
    description: 'Cambio de aceite',
    nextDate: '2026-10-10',
    nextMileage: null,
    classification: 'OVERDUE',
    daysRemaining: -4,
    kmRemaining: null,
    canManage: false,
  ),
  maintenanceJson(
    id: 2,
    clientName: 'Luis Gómez',
    clientPhone: '5587654321',
    vehiclePlate: 'XYZ789',
    vehicleTitle: 'Chevrolet Aveo',
    description: 'Afinación mayor',
    nextDate: null,
    nextMileage: 20500,
    classification: 'UPCOMING',
    daysRemaining: null,
    kmRemaining: 500,
    canManage: false,
  ),
];

void main() {
  testWidgets('test_recepcion_ve_clientes_telefonos_y_chips_de_vencido_y_proximo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler((RecordedRequest r) => listado(_muestra)));
    await abrirMantenimientos(tester, api);

    expect(find.text('Mantenimientos'), findsWidgets);
    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('5512345678'), findsOneWidget);
    expect(find.text('ABC123 · Nissan Versa'), findsOneWidget);
    expect(find.text('Vencido'), findsOneWidget);
    expect(find.text('Próximo'), findsOneWidget);
    expect(find.text('hace 4 d'), findsOneWidget);
    expect(find.text('faltan 500 km'), findsOneWidget);
    expect(find.textContaining('30 días'), findsOneWidget);
    expect(find.textContaining('1,000 km'), findsWidgets);
  });

  testWidgets('test_por_defecto_pide_vencidos_y_proximos', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler((RecordedRequest r) => listado(_muestra)));
    await abrirMantenimientos(tester, api);

    final RecordedRequest peticion = api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance');
    expect(peticion.query['classification'], 'ALERT');
    expect(peticion.query.containsKey('status'), isFalse);
  });

  testWidgets('test_cambiar_el_filtro_envia_la_clasificacion_o_el_estado_correspondiente', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler((RecordedRequest r) => listado(_muestra)));
    await abrirMantenimientos(tester, api);

    await tester.tap(find.text('Vencidos y próximos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Solo vencidos').last);
    await tester.pumpAndSettle();
    expect(api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance').query['classification'], 'OVERDUE');

    await tester.tap(find.text('Solo vencidos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Realizados').last);
    await tester.pumpAndSettle();
    final RecordedRequest realizados = api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance');
    expect(realizados.query['status'], 'REALIZADO');
    expect(realizados.query.containsKey('classification'), isFalse);
  });

  testWidgets('test_la_busqueda_envia_el_texto_por_cliente_o_placa', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler((RecordedRequest r) => listado(_muestra)));
    await abrirMantenimientos(tester, api);

    await tester.enterText(find.byType(TextField).first, 'abc-123');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    expect(api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance').query['search'], 'abc-123');
  });

  testWidgets('test_sin_resultados_muestra_el_mensaje_correspondiente', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler((RecordedRequest r) => listado(<Map<String, dynamic>>[])));
    await abrirMantenimientos(tester, api);
    expect(find.text('No hay mantenimientos por avisar.'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'zzz');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('No se encontraron mantenimientos con esos filtros.'), findsOneWidget);
  });

  testWidgets('test_un_error_del_servidor_muestra_el_mensaje_y_reintentar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      (RecordedRequest r) => jsonError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'),
    ));
    await abrirMantenimientos(tester, api);

    expect(find.text('Ocurrió un error inesperado. Inténtalo de nuevo.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('test_los_cerrados_se_muestran_con_su_estado_y_sin_restante', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      (RecordedRequest r) => listado(<Map<String, dynamic>>[
        maintenanceJson(id: 9, status: 'REALIZADO', classification: null, kmRemaining: null, canManage: false),
      ]),
    ));
    await abrirMantenimientos(tester, api);

    expect(find.text('Realizado'), findsOneWidget);
    expect(find.text('—'), findsWidgets);
  });

  testWidgets('test_pagina_el_listado', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      (RecordedRequest r) => jsonData(
        _muestra,
        meta: <String, dynamic>{
          'page': int.parse(r.query['page'] ?? '1'),
          'pageSize': 20,
          'total': 45,
          'warningDays': 30,
          'warningKm': 1000,
        },
      ),
    ));
    await abrirMantenimientos(tester, api);

    await tester.tap(find.byTooltip('Página siguiente'));
    await tester.pumpAndSettle();

    expect(api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance').query['page'], '2');
  });

  testWidgets('test_el_administrador_tambien_ve_el_listado', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler((RecordedRequest r) => listado(_muestra), role: 'ADMIN'));
    await abrirMantenimientos(tester, api, usuario: 'admin');

    expect(find.text('Ana Pérez'), findsOneWidget);
  });

  testWidgets('test_abrir_una_fila_lleva_al_detalle_del_vehiculo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      (RecordedRequest r) => listado(_muestra),
    ));
    await abrirMantenimientos(tester, api);

    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/vehicles/1'), isTrue);
    expect(find.text('Detalle del vehículo'), findsOneWidget);
  });
}
