import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/app_routes.dart';
import 'package:motorix_client/main.dart';
import 'package:motorix_client/models/service_order.dart';
import 'package:motorix_client/screens/appointments/appointments_list_screen.dart';
import 'package:motorix_client/screens/orders/order_form_screen.dart';

import 'helpers/fake_api.dart';

Future<void> iniciarSesion(WidgetTester tester, FakeApi api) async {
  // La fuente de prueba es más ancha que la real: se usa una ventana amplia.
  tester.view.physicalSize = const Size(2400, 1000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

ServiceOrder ordenExistente({int? mechanicId = 21, String? mechanicName = 'Mario Mecánico', String status = 'DIAGNOSTICO'}) =>
    ServiceOrder.fromJson(orderJson(
      id: 5,
      folio: 'OS-000005',
      mechanicId: mechanicId,
      mechanicName: mechanicName,
      status: status,
      entryMileage: 15000,
      reportedProblem: 'Ruido al frenar',
    ));

http.Response? Function(RecordedRequest) manejador({
  List<RecordedRequest>? parches,
  http.Response Function(RecordedRequest)? respuestaParche,
}) {
  return (RecordedRequest r) {
    if (r.path == '/mechanics') {
      return jsonData(<Map<String, dynamic>>[
        <String, dynamic>{'id': 21, 'name': 'Mario Mecánico', 'username': 'mario'},
        <String, dynamic>{'id': 22, 'name': 'Marta Mecánica', 'username': 'marta'},
      ]);
    }
    if (r.path == '/orders/5' && r.method == 'PATCH') {
      parches?.add(r);
      return respuestaParche?.call(r) ?? jsonData(orderJson(id: 5, folio: 'OS-000005', status: 'DIAGNOSTICO'));
    }
    if (r.path == '/appointments' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[appointmentJson(id: 11, clientId: 7, vehicleId: 3)]);
    }
    return null;
  };
}

/// Abre el formulario de corrección de la orden desde la pantalla actual.
Future<void> abrirCorreccion(WidgetTester tester, ServiceOrder orden) async {
  await tester.tap(find.text('Citas'));
  await tester.pumpAndSettle();
  final BuildContext contexto = tester.element(find.byType(AppointmentsListScreen));
  Navigator.of(contexto).pushNamed(AppRoutes.orderForm, arguments: OrderFormArgs(order: orden));
  await tester.pumpAndSettle();
}

Future<void> elegirMecanico(WidgetTester tester, String nombre) async {
  await tester.tap(find.byType(DropdownButtonFormField<int?>));
  await tester.pumpAndSettle();
  await tester.tap(find.text(nombre).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_el_formulario_de_alta_lista_a_los_mecanicos_activos_y_permite_dejar_sin_asignar',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador()));
    await iniciarSesion(tester, api);
    await tester.tap(find.text('Citas'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Crear orden de servicio'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<int?>));
    await tester.pumpAndSettle();

    expect(find.text('Sin asignar'), findsWidgets);
    expect(find.text('Mario Mecánico'), findsWidgets);
    expect(find.text('Marta Mecánica'), findsWidgets);
  });

  testWidgets('test_el_modo_correccion_precarga_los_datos_actuales', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador()));
    await iniciarSesion(tester, api);

    await abrirCorreccion(tester, ordenExistente());

    expect(find.text('Corregir orden OS-000005'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '15000'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Ruido al frenar'), findsOneWidget);
    expect(find.text('Mario Mecánico'), findsWidgets);
  });

  testWidgets('test_corrige_solo_el_problema_reportado_sin_reasignar', (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(extra: manejador(parches: parches)));
    await iniciarSesion(tester, api);
    await abrirCorreccion(tester, ordenExistente());

    await tester.enterText(find.widgetWithText(TextFormField, 'Ruido al frenar'), 'Ruido y vibración');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(parches, hasLength(1));
    expect(parches.single.body, <String, dynamic>{'reportedProblem': 'Ruido y vibración'});
    expect(find.text('Orden OS-000005 actualizada correctamente.'), findsOneWidget);
  });

  testWidgets('test_pide_confirmacion_al_reasignar_y_no_guarda_si_se_cancela', (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(extra: manejador(parches: parches)));
    await iniciarSesion(tester, api);
    await abrirCorreccion(tester, ordenExistente());

    await elegirMecanico(tester, 'Marta Mecánica');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Reasignar orden'), findsOneWidget);
    expect(find.textContaining('Mario Mecánico'), findsWidgets);
    expect(find.textContaining('Marta Mecánica'), findsWidgets);

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(parches, isEmpty, reason: 'no debía llamar al servidor sin confirmar');
  });

  testWidgets('test_reasigna_al_confirmar_enviando_el_nuevo_mecanico', (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(extra: manejador(parches: parches)));
    await iniciarSesion(tester, api);
    await abrirCorreccion(tester, ordenExistente());

    await elegirMecanico(tester, 'Marta Mecánica');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(parches.single.body, <String, dynamic>{'mechanicId': 22});
  });

  testWidgets('test_asignar_a_una_orden_sin_mecanico_no_pide_confirmacion', (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(extra: manejador(parches: parches)));
    await iniciarSesion(tester, api);
    await abrirCorreccion(tester, ordenExistente(mechanicId: null, mechanicName: null, status: 'RECIBIDO'));

    await elegirMecanico(tester, 'Mario Mecánico');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Reasignar orden'), findsNothing);
    expect(parches.single.body, <String, dynamic>{'mechanicId': 21});
  });

  testWidgets('test_quitar_al_mecanico_envia_null_y_pide_confirmacion', (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(extra: manejador(parches: parches)));
    await iniciarSesion(tester, api);
    await abrirCorreccion(tester, ordenExistente(status: 'RECIBIDO'));

    await elegirMecanico(tester, 'Sin asignar');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('sin mecánico'), findsOneWidget);
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(parches.single.body!.containsKey('mechanicId'), isTrue);
    expect(parches.single.body!['mechanicId'], isNull);
  });

  testWidgets('test_pide_confirmar_la_correccion_si_el_servidor_rechaza_un_kilometraje_menor',
      (WidgetTester tester) async {
    final List<RecordedRequest> parches = <RecordedRequest>[];
    final FakeApi api = FakeApi(baseHandler(
      extra: manejador(
        parches: parches,
        respuestaParche: (RecordedRequest r) {
          if (r.body!['mileageCorrection'] == true) {
            return jsonData(orderJson(id: 5, folio: 'OS-000005'));
          }
          return jsonError(409, 'MILEAGE_DECREASE', 'El kilometraje no puede ser menor al registrado.');
        },
      ),
    ));
    await iniciarSesion(tester, api);
    await abrirCorreccion(tester, ordenExistente());

    await tester.enterText(find.widgetWithText(TextFormField, '15000'), '9000');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Kilometraje menor al registrado'), findsOneWidget);
    await tester.tap(botonDelDialogo('Confirmar'));
    await tester.pumpAndSettle();

    expect(parches, hasLength(2));
    expect(parches.last.body, <String, dynamic>{'entryMileage': 9000, 'mileageCorrection': true});
  });
}
