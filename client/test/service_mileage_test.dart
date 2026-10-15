import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> abrirOrden(WidgetTester tester, FakeApi api) async {
  tester.view.physicalSize = const Size(2400, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'mecanico');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000005'));
  await tester.pumpAndSettle();
}

Finder enDialogo(Finder f) => find.descendant(of: find.byType(AlertDialog), matching: f);
Finder botonDelDialogo(String texto) => enDialogo(find.text(texto));
Finder campoDelDialogo(String etiqueta) => enDialogo(find.widgetWithText(TextFormField, etiqueta));

class EstadoKm {
  EstadoKm({this.status = 'EN_REPARACION', this.editable = true, this.serviceMileage});

  String status;
  bool editable;
  int? serviceMileage;

  Map<String, dynamic> json() => orderJson(
        id: 5,
        folio: 'OS-000005',
        status: status,
        mechanicId: 1,
        mechanicName: 'Persona de prueba',
        entryMileage: 20000,
        serviceMileage: serviceMileage,
        editableWork: editable,
        editableNotes: editable,
        editableParts: editable,
      );
}

FakeHandler handler(EstadoKm estado, {http.Response? Function(RecordedRequest)? extra}) => baseHandler(
      role: 'MECHANIC',
      extra: (RecordedRequest r) {
        final http.Response? propia = extra?.call(r);
        if (propia != null) return propia;
        if (r.path == '/orders' && r.method == 'GET') {
          return listOf(<Map<String, dynamic>>[orderJson(id: 5, folio: 'OS-000005')]);
        }
        if (r.path == '/orders/5' && r.method == 'GET') return jsonData(estado.json());
        return null;
      },
    );

void main() {
  testWidgets('test_sin_kilometraje_de_servicio_ofrece_registrarlo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(EstadoKm()));
    await abrirOrden(tester, api);

    expect(find.text('Kilometraje de servicio'), findsOneWidget);
    expect(find.text('Registrar kilometraje de servicio'), findsOneWidget);
  });

  testWidgets('test_registra_un_kilometraje_valido_y_lo_muestra', (WidgetTester tester) async {
    final EstadoKm estado = EstadoKm();
    final FakeApi api = FakeApi(handler(
      estado,
      extra: (RecordedRequest r) {
        if (r.path == '/orders/5/work' && r.method == 'PATCH') {
          estado.serviceMileage = r.body!['serviceMileage'] as int;
          return jsonData(estado.json());
        }
        return null;
      },
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar kilometraje de servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Kilometraje de servicio *'), '20350');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest envio = api.requests.lastWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(envio.body, <String, dynamic>{'serviceMileage': 20350});
    expect(find.text('Kilometraje de servicio guardado.'), findsOneWidget);
    expect(find.text('20,350 km'), findsOneWidget);
    expect(find.text('Editar kilometraje de servicio'), findsOneWidget);
  });

  testWidgets('test_rechaza_un_kilometraje_menor_al_de_entrada_vacio_o_invalido', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(EstadoKm()));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar kilometraje de servicio'));
    await tester.pumpAndSettle();

    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('Ingresa el kilometraje de servicio.'), findsOneWidget);

    await tester.enterText(campoDelDialogo('Kilometraje de servicio *'), '19999');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No puede ser menor al de entrada (20,000 km)'), findsOneWidget);

    await tester.enterText(campoDelDialogo('Kilometraje de servicio *'), '-3');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();
    expect(find.text('El kilometraje debe ser un número entero no negativo.'), findsOneWidget);

    expect(api.requests.any((RecordedRequest r) => r.method == 'PATCH'), isFalse);
  });

  testWidgets('test_muestra_el_error_del_servidor_al_guardar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(
      EstadoKm(),
      extra: (RecordedRequest r) => r.path == '/orders/5/work' && r.method == 'PATCH'
          ? jsonError(409, 'ORDER_NOT_EDITABLE', 'La orden en estado ENTREGADO no admite este cambio.')
          : null,
    ));
    await abrirOrden(tester, api);

    await tester.tap(find.text('Registrar kilometraje de servicio'));
    await tester.pumpAndSettle();
    await tester.enterText(campoDelDialogo('Kilometraje de servicio *'), '20100');
    await tester.tap(botonDelDialogo('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('La orden en estado ENTREGADO no admite este cambio.'), findsOneWidget);
  });

  testWidgets('test_una_orden_entregada_muestra_el_valor_sin_ofrecer_editarlo', (WidgetTester tester) async {
    final FakeApi api = FakeApi(handler(EstadoKm(status: 'ENTREGADO', editable: false, serviceMileage: 20400)));
    await abrirOrden(tester, api);

    expect(find.text('20,400 km'), findsOneWidget);
    expect(find.text('Editar kilometraje de servicio'), findsNothing);
    expect(find.text('Registrar kilometraje de servicio'), findsNothing);
  });
}
