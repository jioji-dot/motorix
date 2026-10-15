import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

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

Finder enDialogo(Finder f) => find.descendant(of: find.byType(AlertDialog), matching: f);
Finder botonDelDialogo(String texto) => enDialogo(find.text(texto));
Finder campoDelDialogo(String etiqueta) => enDialogo(find.widgetWithText(TextFormField, etiqueta));

FakeHandler handler(
  List<Map<String, dynamic>> Function() mantenimientos, {
  String role = 'MECHANIC',
  http.Response? Function(RecordedRequest)? extra,
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
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
        if (r.path == '/vehicles/1/maintenance') return jsonData(mantenimientos());
        return null;
      },
    );

void main() {
  testWidgets('test_muestra_el_pendiente_con_su_clasificacion_los_restantes_y_los_antecedentes', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(() => <Map<String, dynamic>>[
          maintenanceJson(
            id: 2,
            description: 'Cambio de aceite',
            nextDate: '2026-10-10',
            nextMileage: 19500,
            classification: 'OVERDUE',
            daysRemaining: -4,
            kmRemaining: -500,
          ),
          maintenanceJson(id: 1, description: 'Afinación anterior', status: 'REALIZADO', classification: null, canManage: false),
        ]));
    await abrirVehiculo(tester, api);

    expect(find.text('Mantenimiento'), findsOneWidget);
    expect(find.text('Cambio de aceite'), findsOneWidget);
    expect(find.text('Vencido'), findsOneWidget);
    expect(find.textContaining('venció hace 4 días'), findsOneWidget);
    expect(find.textContaining('excedido por 500 km'), findsOneWidget);
    expect(find.text('Antecedentes'), findsOneWidget);
    expect(find.text('Afinación anterior'), findsOneWidget);
    expect(find.text('Realizado'), findsOneWidget);
  });

  testWidgets('test_sin_pendiente_explica_donde_se_registra', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(() => <Map<String, dynamic>>[]));
    await abrirVehiculo(tester, api);

    expect(find.textContaining('No hay un mantenimiento programado'), findsOneWidget);
  });

  testWidgets('test_las_acciones_aparecen_solo_cuando_el_servidor_permite_gestionarlo', (WidgetTester tester) async {
    final FakeApi conPermiso = FakeApi(handler(() => <Map<String, dynamic>>[maintenanceJson(canManage: true)]));
    await abrirVehiculo(tester, conPermiso);
    expect(find.text('Marcar como realizado'), findsOneWidget);
    expect(find.text('Cancelar mantenimiento'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());

    final FakeApi sinPermiso = FakeApi(handler(() => <Map<String, dynamic>>[maintenanceJson(canManage: false)]));
    await abrirVehiculo(tester, sinPermiso);
    expect(find.text('Cambio de aceite y filtro'), findsOneWidget);
    expect(find.text('Marcar como realizado'), findsNothing);
    expect(find.text('Cancelar mantenimiento'), findsNothing);
  });

  testWidgets('test_marcar_como_realizado_pide_confirmacion_y_recarga', (WidgetTester tester) async {
    bool realizado = false;
    final FakeApi api = FakeApi(handler(
      () => realizado
          ? <Map<String, dynamic>>[maintenanceJson(status: 'REALIZADO', classification: null, canManage: false)]
          : <Map<String, dynamic>>[maintenanceJson()],
      extra: (RecordedRequest r) {
        if (r.path == '/maintenance/1/complete' && r.method == 'POST') {
          realizado = true;
          return jsonData(maintenanceJson(status: 'REALIZADO', classification: null, canManage: false));
        }
        return null;
      },
    ));
    await abrirVehiculo(tester, api);

    await tester.tap(find.text('Marcar como realizado'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Se conservará como antecedente'), findsOneWidget);
    await tester.tap(botonDelDialogo('Marcar como realizado'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/maintenance/1/complete'), isTrue);
    expect(find.text('Mantenimiento marcado como realizado.'), findsOneWidget);
    expect(find.text('Antecedentes'), findsOneWidget);
  });

  testWidgets('test_volver_en_la_confirmacion_no_cancela_el_mantenimiento', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(() => <Map<String, dynamic>>[maintenanceJson()]));
    await abrirVehiculo(tester, api);

    await tester.tap(find.text('Cancelar mantenimiento'));
    await tester.pumpAndSettle();
    expect(find.text('Cancelar mantenimiento'), findsWidgets);
    await tester.tap(botonDelDialogo('Volver'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path.endsWith('/cancel')), isFalse);
  });

  testWidgets('test_confirmar_la_cancelacion_llama_al_servidor', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      () => <Map<String, dynamic>>[maintenanceJson()],
      extra: (RecordedRequest r) => r.path == '/maintenance/1/cancel' && r.method == 'POST'
          ? jsonData(maintenanceJson(status: 'CANCELADO', classification: null, canManage: false))
          : null,
    ));
    await abrirVehiculo(tester, api);

    await tester.tap(find.text('Cancelar mantenimiento'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Cancelar mantenimiento'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.path == '/maintenance/1/cancel' && r.method == 'POST'), isTrue);
    expect(find.text('Mantenimiento cancelado.'), findsOneWidget);
  });

  testWidgets('test_editar_envia_solo_los_datos_que_cambian', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      () => <Map<String, dynamic>>[maintenanceJson(description: 'Original', nextMileage: 25000)],
      extra: (RecordedRequest r) => r.path == '/maintenance/1' && r.method == 'PATCH'
          ? jsonData(maintenanceJson(description: 'Original', nextMileage: 26000))
          : null,
    ));
    await abrirVehiculo(tester, api);

    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();
    expect(campoDelDialogo('Kilometraje objetivo'), findsOneWidget);
    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '26000');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(envio.body, <String, dynamic>{'nextMileage': 26000});
    expect(find.text('Mantenimiento actualizado correctamente.'), findsOneWidget);
  });

  testWidgets('test_quitar_la_fecha_al_editar_envia_null', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      () => <Map<String, dynamic>>[maintenanceJson(nextDate: '2030-01-15', nextMileage: 25000)],
      extra: (RecordedRequest r) => r.path == '/maintenance/1' && r.method == 'PATCH'
          ? jsonData(maintenanceJson(nextMileage: 25000))
          : null,
    ));
    await abrirVehiculo(tester, api);

    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Quitar fecha'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(envio.body, <String, dynamic>{'nextDate': null});
  });

  testWidgets('test_editar_sin_cambios_no_llama_al_servidor', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(() => <Map<String, dynamic>>[maintenanceJson()]));
    await abrirVehiculo(tester, api);

    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(api.requests.any((RecordedRequest r) => r.method == 'PATCH'), isFalse);
  });

  testWidgets('test_un_error_al_cargar_los_mantenimientos_muestra_el_mensaje_con_reintento', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      () => <Map<String, dynamic>>[],
      extra: (RecordedRequest r) => r.path == '/vehicles/1/maintenance'
          ? jsonError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.')
          : null,
    ));
    await abrirVehiculo(tester, api);

    expect(find.text('Ocurrió un error inesperado. Inténtalo de nuevo.'), findsWidgets);
    expect(find.text('Reintentar'), findsWidgets);
  });
}
