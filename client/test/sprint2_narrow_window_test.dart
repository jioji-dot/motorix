import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

/// Ventana angosta (800 px): el sidebar arranca colapsado y las pantallas no deben desbordarse.
Future<void> iniciarSesionAngosta(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(800, 700);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

http.Response? Function(RecordedRequest) manejador() {
  return (RecordedRequest r) {
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[
        orderJson(id: 5, folio: 'OS-000005', status: 'EN_REPARACION', mechanicName: 'Mario Mecánico', total: 1150.5),
      ]);
    }
    if (r.path == '/orders/5') {
      return jsonData(orderJson(
        id: 5,
        folio: 'OS-000005',
        status: 'EN_REPARACION',
        mechanicId: 1,
        mechanicName: 'Mario Mecánico',
        diagnosis: 'Balatas gastadas',
        services: <Map<String, dynamic>>[
          <String, dynamic>{'id': 1, 'description': 'Cambio de balatas delanteras y traseras', 'amount': 850.5},
        ],
        labor: <Map<String, dynamic>>[
          <String, dynamic>{'id': 1, 'description': 'Montaje y balanceo', 'hours': 2, 'hourlyRate': 150, 'amount': 300},
        ],
        servicesSubtotal: 850.5,
        laborSubtotal: 300,
        total: 1150.5,
        allowedTransitions: <String>['ESPERANDO_REFACCION', 'TERMINADO'],
        editableWork: true,
        editableNotes: true,
      ));
    }
    if (r.path == '/appointments' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[
        appointmentJson(id: 1, reason: 'Revisión general de frenos y suspensión'),
        appointmentJson(id: 2, status: 'CONFIRMADA', clientName: 'Luis Gómez Herrera'),
      ]);
    }
    if (r.path == '/mechanics') return jsonData(<Map<String, dynamic>>[]);
    return null;
  };
}

void main() {
  testWidgets('test_mis_ordenes_y_el_detalle_no_se_desbordan_en_una_ventana_angosta', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador()));
    await iniciarSesionAngosta(tester, api);

    expect(find.text('OS-000005'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el listado no debía desbordarse');

    await tester.tap(find.text('OS-000005'));
    await tester.pumpAndSettle();

    expect(find.text('Detalle de la orden'), findsOneWidget);
    expect(find.text('Marcar como terminado'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el detalle no debía desbordarse');
  });

  testWidgets('test_citas_ordenes_y_formularios_no_se_desbordan_en_una_ventana_angosta', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: manejador()));
    await iniciarSesionAngosta(tester, api);

    await tester.tap(find.byTooltip('Citas'));
    await tester.pumpAndSettle();
    expect(find.text('Nueva cita'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el listado de citas no debía desbordarse');

    await tester.tap(find.text('Nueva cita'));
    await tester.pumpAndSettle();
    expect(find.text('Guardar'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el formulario de cita no debía desbordarse');
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Órdenes'));
    await tester.pumpAndSettle();
    expect(find.text('Nueva orden'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el listado de órdenes no debía desbordarse');

    await tester.tap(find.text('Nueva orden'));
    await tester.pumpAndSettle();
    expect(find.text('Crear orden'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el formulario de orden no debía desbordarse');
  });
}
