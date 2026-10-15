import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';
import 'package:motorix_client/utils/format.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api, {String usuario = 'mecanico'}) async {
  tester.view.physicalSize = const Size(2400, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  if (usuario != 'mecanico') {
    await tester.tap(find.text('Órdenes'));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

Finder enDialogo(Finder f) => find.descendant(of: find.byType(AlertDialog), matching: f);
Finder botonDelDialogo(String texto) => enDialogo(find.text(texto));
Finder campoDelDialogo(String etiqueta) => enDialogo(find.widgetWithText(TextFormField, etiqueta));

FakeHandler handler({
  String role = 'MECHANIC',
  String status = 'TERMINADO',
  int? mechanicId = 1,
  http.Response? Function(RecordedRequest)? extra,
}) =>
    baseHandler(
      role: role,
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/orders' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
        }
        if (r.path == '/orders/5' && r.method == 'GET') {
          return jsonData(orderJson(
            id: 5,
            folio: 'OS-000005',
            status: status,
            mechanicId: mechanicId,
            mechanicName: 'Persona de prueba',
            entryMileage: 20000,
          ));
        }
        return null;
      },
    );

void main() {
  testWidgets('test_el_mecanico_asignado_ve_el_boton_en_una_orden_terminada', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirOrden(tester, api);

    expect(find.text('Registrar próximo mantenimiento'), findsOneWidget);
  });

  testWidgets('test_el_boton_tambien_aparece_en_una_orden_entregada_y_para_el_administrador', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(role: 'ADMIN', status: 'ENTREGADO', mechanicId: 99));
    await abrirOrden(tester, api, usuario: 'admin');

    expect(find.text('Registrar próximo mantenimiento'), findsOneWidget);
  });

  testWidgets('test_no_aparece_en_una_orden_en_proceso_ni_para_otro_mecanico_ni_para_recepcion', (WidgetTester tester) async {
    for (final FakeHandler h in <FakeHandler>[
      handler(status: 'EN_REPARACION'),
      handler(mechanicId: 77),
    ]) {
      await abrirOrden(tester, FakeApi(h));
      expect(find.text('Registrar próximo mantenimiento'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    }

    await abrirOrden(tester, FakeApi(handler(role: 'RECEPTIONIST')), usuario: 'recepcion');
    expect(find.text('Registrar próximo mantenimiento'), findsNothing);
  });

  testWidgets('test_exige_descripcion_y_fecha_o_kilometraje', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ingresa la descripción.'), findsOneWidget);
    expect(find.text('Indica la fecha, el kilometraje o ambos.'), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.path == '/maintenance'), isFalse);
  });

  testWidgets('test_rechaza_un_kilometraje_menor_al_actual_o_invalido', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler());
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Afinación');
    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '1000');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No puede ser menor al kilometraje actual'), findsOneWidget);

    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '-5');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('El kilometraje debe ser un número entero no negativo.'), findsOneWidget);
    expect(api.requests.any((RecordedRequest r) => r.path == '/maintenance'), isFalse);
  });

  testWidgets('test_registra_por_kilometraje_y_envia_la_orden_de_origen', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/maintenance' && r.method == 'POST'
          ? jsonData(maintenanceJson(), status: 201)
          : null,
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), '  Cambio de aceite  ');
    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '25000');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance');
    expect(envio.body, <String, dynamic>{
      'orderId': 5,
      'description': 'Cambio de aceite',
      'nextDate': null,
      'nextMileage': 25000,
    });
    expect(find.text('Próximo mantenimiento registrado correctamente.'), findsOneWidget);
  });

  testWidgets('test_registra_por_fecha_con_el_selector_de_fecha', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/maintenance' && r.method == 'POST'
          ? jsonData(maintenanceJson(nextDate: Format.isoDate(DateTime.now())), status: 201)
          : null,
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Revisión anual');
    await tester.tap(find.text('Elegir fecha'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aceptar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance');
    expect(envio.body!['nextDate'], Format.isoDate(DateTime.now()));
    expect(envio.body!['nextMileage'], isNull);
  });

  testWidgets('test_con_un_pendiente_existente_pide_confirmar_el_reemplazo', (WidgetTester tester) async {
    int intentos = 0;
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) {
        if (r.path != '/maintenance' || r.method != 'POST') return null;
        intentos++;
        if (r.body!['replacePending'] == true) return jsonData(maintenanceJson(), status: 201);
        return jsonError(409, 'MAINTENANCE_PENDING_EXISTS', 'El vehículo ya tiene un mantenimiento pendiente.',
            details: <String, dynamic>{
              'pending': maintenanceJson(id: 3, description: 'Afinación mayor'),
            });
      },
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Cambio de aceite');
    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '25000');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Reemplazar mantenimiento pendiente'), findsOneWidget);
    expect(find.textContaining('Afinación mayor'), findsOneWidget);
    await tester.tap(botonDelDialogo('Reemplazar'));
    await tester.pumpAndSettle();

    expect(intentos, 2);
    final RecordedRequest ultimo = api.requests.lastWhere((RecordedRequest r) => r.path == '/maintenance');
    expect(ultimo.body!['replacePending'], isTrue);
    expect(find.text('Próximo mantenimiento registrado correctamente.'), findsOneWidget);
  });

  testWidgets('test_si_no_confirma_el_reemplazo_no_se_vuelve_a_enviar', (WidgetTester tester) async {
    int intentos = 0;
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) {
        if (r.path != '/maintenance' || r.method != 'POST') return null;
        intentos++;
        return jsonError(409, 'MAINTENANCE_PENDING_EXISTS', 'El vehículo ya tiene un mantenimiento pendiente.',
            details: <String, dynamic>{'pending': maintenanceJson(id: 3)});
      },
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Otro');
    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '25000');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(intentos, 1);
  });

  testWidgets('test_muestra_el_error_del_servidor_si_la_orden_no_esta_terminada', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      extra: (RecordedRequest r) => r.path == '/maintenance' && r.method == 'POST'
          ? jsonError(409, 'ORDER_NOT_FINISHED', 'El mantenimiento se registra desde una orden terminada o entregada.')
          : null,
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar próximo mantenimiento'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Descripción *'), 'Revisión');
    await tester.enterText(campoDelDialogo('Kilometraje objetivo'), '25000');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('El mantenimiento se registra desde una orden terminada o entregada.'), findsOneWidget);
  });
}
