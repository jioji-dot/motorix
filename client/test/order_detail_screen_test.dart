import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

/// Inicia sesión como mecánico (su pantalla inicial es "Mis órdenes") y abre el detalle de OS-000005.
Future<void> abrirDetalle(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(2400, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

http.Response? Function(RecordedRequest) manejador(Map<String, dynamic> detalle) {
  return (RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
    }
    if (r.path == '/orders/5' && r.method == 'GET') return jsonData(detalle);
    if (r.path == '/mechanics') return jsonData(<Map<String, dynamic>>[]);
    return null;
  };
}

Map<String, dynamic> ordenCompleta({bool editarBasicos = false}) => orderJson(
      id: 5,
      folio: 'OS-000005',
      status: 'EN_REPARACION',
      mechanicId: 21,
      mechanicName: 'Mario Mecánico',
      entryMileage: 15000,
      reportedProblem: 'Ruido al frenar',
      diagnosis: 'Balatas gastadas',
      notes: 'Discos con desgaste leve',
      recommendations: 'Revisar los discos en 5,000 km',
      services: <Map<String, dynamic>>[
        <String, dynamic>{'id': 1, 'description': 'Cambio de balatas', 'amount': 850.5},
      ],
      labor: <Map<String, dynamic>>[
        <String, dynamic>{'id': 1, 'description': 'Montaje', 'hours': 2, 'hourlyRate': 150, 'amount': 300},
      ],
      servicesSubtotal: 850.5,
      laborSubtotal: 300,
      total: 1150.5,
      statusHistory: <Map<String, dynamic>>[
        <String, dynamic>{
          'fromStatus': null,
          'toStatus': 'RECIBIDO',
          'changedBy': <String, dynamic>{'id': 1, 'name': 'Rosa Recepción'},
          'createdAt': '2026-10-12T12:00:00.000Z',
        },
        <String, dynamic>{
          'fromStatus': 'RECIBIDO',
          'toStatus': 'DIAGNOSTICO',
          'changedBy': <String, dynamic>{'id': 21, 'name': 'Mario Mecánico'},
          'createdAt': '2026-10-12T13:00:00.000Z',
        },
      ],
      editableBasic: editarBasicos,
    );

void main() {
  testWidgets('test_muestra_datos_trabajo_importes_e_historial_de_la_orden', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador(ordenCompleta())));
    await abrirDetalle(tester, api);

    expect(find.text('OS-000005'), findsOneWidget);
    expect(find.text('En reparación'), findsWidgets);
    expect(find.text('Ruido al frenar'), findsOneWidget);
    expect(find.text('Balatas gastadas'), findsOneWidget);
    expect(find.text('Cambio de balatas'), findsOneWidget);
    expect(find.text(r'$850.50'), findsWidgets);
    expect(find.text('Montaje'), findsOneWidget);
    expect(find.text('2.00'), findsOneWidget);
    expect(find.text(r'$1,150.50'), findsOneWidget);
    expect(find.text('Discos con desgaste leve'), findsOneWidget);
    expect(find.text('Revisar los discos en 5,000 km'), findsOneWidget);
    expect(find.text('15,000 km'), findsOneWidget);
    expect(find.textContaining('por Rosa Recepción'), findsOneWidget);
    expect(find.textContaining('por Mario Mecánico'), findsOneWidget);
  });

  testWidgets('test_las_secciones_vacias_muestran_un_texto_claro', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador(orderJson(id: 5, folio: 'OS-000005'))));
    await abrirDetalle(tester, api);

    expect(find.text('Sin asignar'), findsOneWidget);
    expect(find.text('Aún no hay diagnóstico registrado.'), findsOneWidget);
    expect(find.text('Aún no hay servicios registrados.'), findsOneWidget);
    expect(find.text('Aún no hay mano de obra registrada.'), findsOneWidget);
    expect(find.text('Sin observaciones.'), findsOneWidget);
    expect(find.text('Sin recomendaciones.'), findsOneWidget);
  });

  testWidgets('test_el_boton_de_correccion_solo_aparece_si_el_servidor_lo_permite', (WidgetTester tester) async {
    final FakeApi sin = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador(ordenCompleta())));
    await abrirDetalle(tester, sin);
    expect(find.text('Corregir datos'), findsNothing);
  });

  testWidgets('test_con_permiso_de_correccion_muestra_el_boton', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador(ordenCompleta(editarBasicos: true))));
    await abrirDetalle(tester, api);

    expect(find.text('Corregir datos'), findsOneWidget);

    await tester.tap(find.text('Corregir datos'));
    await tester.pumpAndSettle();

    expect(find.text('Corregir orden OS-000005'), findsOneWidget);
  });

  testWidgets('test_un_error_al_cargar_el_detalle_muestra_el_mensaje_y_permite_reintentar',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: (RecordedRequest r) {
      if (r.path == '/orders' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
      }
      if (r.path == '/orders/5') return jsonError(404, 'NOT_FOUND', 'La orden no existe.');
      return null;
    }));
    await abrirDetalle(tester, api);

    expect(find.text('La orden no existe.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });
}
