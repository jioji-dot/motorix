import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

/// Ventana angosta (800 px): el sidebar arranca colapsado y las pantallas no deben desbordarse.
Future<void> iniciarSesionAngosta(WidgetTester tester, FakeApi api, String usuario) async {
  tester.view.physicalSize = const Size(800, 700);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), usuario);
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

http.Response? Function(RecordedRequest) manejador() {
  return (RecordedRequest r) {
    if (r.path == '/parts/alerts') {
      return jsonData(<String, dynamic>{'low': 1, 'out': 1, 'total': 2});
    }
    if (r.path == '/parts' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[
        partJson(id: 1, code: 'ACE-5W30', name: 'Aceite sintético 5W-30 (1 L) de alto rendimiento', stock: 40),
        partJson(id: 2, code: 'BAL-TRA', name: 'Balatas traseras (juego)', stock: 3, minimumStock: 4),
        partJson(id: 3, code: 'TERM-90', name: 'Termostato 90 °C', stock: 0, minimumStock: 3),
      ]);
    }
    if (r.path == '/parts/1' && r.method == 'GET') {
      return jsonData(partJson(
        id: 1,
        code: 'ACE-5W30',
        name: 'Aceite sintético 5W-30 (1 L) de alto rendimiento',
        description: 'Aceite sintético para motor de gasolina con una descripción larga para probar el ajuste',
        stock: 40,
      ));
    }
    if (r.path == '/parts/1/movements') {
      return listOf(<Map<String, dynamic>>[
        movementJson(id: 2, partId: 1, type: 'OUT', quantity: -4, reason: 'Semilla: uso en la orden OS-000006', orderId: 6, orderFolio: 'OS-000006'),
        movementJson(id: 1, partId: 1, quantity: 44, reason: 'Semilla: existencia inicial'),
      ]);
    }
    if (r.path == '/maintenance' && r.method == 'GET') {
      return jsonData(
        <Map<String, dynamic>>[
          maintenanceJson(
            id: 1,
            clientName: 'Ana Pérez Morales con un nombre bastante largo',
            description: 'Cambio de aceite y filtro con una descripción larga',
            nextDate: '2026-10-10',
            nextMileage: 48000,
            classification: 'OVERDUE',
            daysRemaining: -4,
            kmRemaining: -200,
            canManage: false,
          ),
        ],
        meta: <String, dynamic>{'page': 1, 'pageSize': 20, 'total': 1, 'warningDays': 30, 'warningKm': 1000},
      );
    }
    if (r.path == '/vehicles' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[vehicleJson(id: 1, licensePlate: 'PRD482A', ownerName: 'Ana Pérez Morales')]);
    }
    if (r.path == '/vehicles/1' && r.method == 'GET') {
      return jsonData(<String, dynamic>{
        ...vehicleJson(id: 1, licensePlate: 'PRD482A', currentMileage: 48200),
        'owner': <String, dynamic>{'id': 1, 'name': 'Ana Pérez Morales', 'phone': '5511223344'},
      });
    }
    if (r.path == '/vehicles/1/history') {
      return listOf(<Map<String, dynamic>>[
        <String, dynamic>{
          'orderId': 9,
          'folio': 'OS-000009',
          'status': 'ENTREGADO',
          'serviceDate': '2026-08-25T12:00:00.000Z',
          'mileage': 47150,
          'mechanicName': 'Mecánico Motorix',
          'reportedProblem': 'Afinación mayor con un problema reportado bastante largo para el ancho',
          'diagnosis': 'Bujías agotadas y termostato con falla en el sistema de enfriamiento',
          'recommendations': 'Programar el siguiente cambio de aceite',
          'services': <Map<String, dynamic>>[
            <String, dynamic>{'description': 'Afinación mayor del motor', 'amount': 450},
          ],
          'labor': <Map<String, dynamic>>[],
          'parts': <Map<String, dynamic>>[
            <String, dynamic>{'code': 'BUJ-NGK', 'name': 'Bujía de iridio', 'quantity': 4, 'unitPrice': 95, 'amount': 380},
          ],
          'total': 830,
        },
      ]);
    }
    if (r.path == '/vehicles/1/maintenance') {
      return jsonData(<Map<String, dynamic>>[
        maintenanceJson(
          description: 'Cambio de aceite y filtro con una descripción larga',
          nextDate: '2026-12-10',
          nextMileage: 52000,
          classification: 'LATER',
          daysRemaining: 57,
          kmRemaining: 3800,
        ),
      ]);
    }
    if (r.path == '/orders' && r.method == 'GET') {
      return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
    }
    if (r.path == '/orders/5') {
      return jsonData(orderJson(
        id: 5,
        folio: 'OS-000005',
        status: 'EN_REPARACION',
        mechanicId: 1,
        mechanicName: 'Persona de prueba',
        serviceMileage: 15100,
        parts: <Map<String, dynamic>>[
          orderPartJson(id: 1, name: 'Filtro de aceite de alto rendimiento y larga duración', quantity: 2),
        ],
        partsSubtotal: 240,
        total: 240,
        editableWork: true,
        editableNotes: true,
        editableParts: true,
      ));
    }
    if (r.path == '/parts/available') {
      return jsonData(<Map<String, dynamic>>[
        <String, dynamic>{'id': 1, 'code': 'FIL-01', 'name': 'Filtro de aceite de alto rendimiento', 'price': 120, 'stock': 4},
      ]);
    }
    return null;
  };
}

void main() {
  testWidgets('test_inventario_y_detalle_de_la_refaccion_no_se_desbordan_en_una_ventana_angosta', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'ADMIN', extra: manejador()));
    await iniciarSesionAngosta(tester, api, 'admin');

    await tester.tap(find.byTooltip('Inventario'));
    await tester.pumpAndSettle();
    expect(find.text('Nueva refacción'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el inventario no debía desbordarse');

    await tester.tap(find.text('Nueva refacción'));
    await tester.pumpAndSettle();
    expect(find.text('Guardar'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el formulario de refacción no debía desbordarse');
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Aceite sintético'));
    await tester.pumpAndSettle();
    expect(find.text('Registrar entrada'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el detalle de la refacción no debía desbordarse');

    await tester.tap(find.text('Registrar entrada'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'el diálogo de entrada no debía desbordarse');
  });

  testWidgets('test_mantenimientos_no_se_desborda_en_una_ventana_angosta', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'RECEPTIONIST', extra: manejador()));
    await iniciarSesionAngosta(tester, api, 'recepcion');

    await tester.tap(find.byTooltip('Mantenimientos'));
    await tester.pumpAndSettle();

    expect(find.text('Vencido'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el listado de mantenimientos no debía desbordarse');
  });

  testWidgets('test_el_detalle_del_vehiculo_con_historial_y_mantenimiento_no_se_desborda', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador()));
    await iniciarSesionAngosta(tester, api, 'mecanico');

    await tester.tap(find.byTooltip('Vehículos'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('PRD482A'));
    await tester.pumpAndSettle();

    expect(find.text('Detalle del vehículo'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el detalle del vehículo no debía desbordarse');

    await tester.scrollUntilVisible(find.text('OS-000009'), 300, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ver detalle del servicio'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'la tarjeta del historial no debía desbordarse');
  });

  testWidgets('test_el_detalle_de_la_orden_con_refacciones_y_los_dialogos_no_se_desbordan', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC', extra: manejador()));
    await iniciarSesionAngosta(tester, api, 'mecanico');

    await tester.tap(find.text('OS-000005'));
    await tester.pumpAndSettle();
    expect(find.text('Detalle de la orden'), findsOneWidget);
    expect(tester.takeException(), isNull, reason: 'el detalle de la orden no debía desbordarse');

    await tester.scrollUntilVisible(find.text('Agregar refacción'), 300, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Agregar refacción'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'el selector de refacciones no debía desbordarse');
  });
}
