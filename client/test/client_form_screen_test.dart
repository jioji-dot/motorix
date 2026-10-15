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
  // El mecánico inicia en "Mis órdenes": se abre Clientes desde el menú lateral.
  await tester.tap(find.descendant(of: find.byType(NavigationRail), matching: find.text('Clientes')));
  await tester.pumpAndSettle();
}

Future<void> abrirFormularioNuevo(WidgetTester tester) async {
  await tester.tap(find.text('Nuevo cliente'));
  await tester.pumpAndSettle();
}

Finder campo(String etiqueta) =>
    find.widgetWithText(TextFormField, etiqueta);

/// Botón dentro del diálogo abierto (evita confundirlo con el del formulario).
Finder botonDelDialogo(String texto) =>
    find.descendant(of: find.byType(AlertDialog), matching: find.text(texto));

void main() {
  testWidgets('test_el_listado_muestra_los_clientes_recibidos', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.path == '/clients' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[
          clientJson(id: 1, name: 'Ana Pérez'),
          clientJson(id: 2, name: 'Luis Gómez', phone: '5522222222'),
        ]);
      }
      return null;
    }));
    await abrirComoRol(tester, api);

    expect(find.text('Ana Pérez'), findsOneWidget);
    expect(find.text('Luis Gómez'), findsOneWidget);
    expect(find.text('1–2 de 2'), findsOneWidget);
  });

  testWidgets('test_el_listado_vacio_sugiere_registrar_el_primer_cliente', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);

    expect(find.text('Aún no hay clientes registrados.'), findsOneWidget);
    expect(find.text('Registrar el primer cliente'), findsOneWidget);
  });

  testWidgets('test_el_mecanico_no_ve_el_boton_para_registrar_clientes', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(role: 'MECHANIC'));
    await abrirComoRol(tester, api);

    expect(find.text('Nuevo cliente'), findsNothing);
    expect(find.text('Registrar el primer cliente'), findsNothing);
  });

  testWidgets('test_no_guarda_si_faltan_el_nombre_y_el_telefono', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Ingresa el nombre.'), findsOneWidget);
    expect(find.text('El teléfono es obligatorio.'), findsOneWidget);
    expect(api.requests.where((RecordedRequest r) => r.method == 'POST' && r.path == '/clients'), isEmpty);
  });

  testWidgets('test_rechaza_un_correo_con_formato_invalido', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.enterText(campo('Nombre *'), 'Ana Pérez');
    await tester.enterText(campo('Teléfono *'), '5512345678');
    await tester.enterText(campo('Correo electrónico'), 'sin-arroba');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Escribe un correo electrónico válido.'), findsOneWidget);
  });

  testWidgets('test_registra_el_cliente_y_vuelve_al_listado_con_mensaje_de_exito',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.method == 'POST' && r.path == '/clients') {
        return jsonData(clientJson(name: 'Ana Pérez'), status: 201);
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.enterText(campo('Nombre *'), 'Ana Pérez');
    await tester.enterText(campo('Teléfono *'), '5512345678');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    final RecordedRequest alta =
        api.requests.firstWhere((RecordedRequest r) => r.method == 'POST' && r.path == '/clients');
    expect(alta.body!['name'], 'Ana Pérez');
    expect(alta.body!.containsKey('confirmDuplicatePhone'), isFalse);
    expect(find.text('Cliente registrado correctamente.'), findsOneWidget);
    expect(find.text('Nuevo cliente'), findsOneWidget, reason: 'volvió al listado');
  });

  testWidgets('test_pide_confirmacion_cuando_el_telefono_ya_existe_y_guarda_si_se_confirma',
      (WidgetTester tester) async {
    int altas = 0;
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.method == 'POST' && r.path == '/clients') {
        altas++;
        if (r.body!['confirmDuplicatePhone'] == true) {
          return jsonData(clientJson(), status: 201);
        }
        return jsonError(
          409,
          'PHONE_DUPLICATE_WARNING',
          'Ya existe un cliente con ese teléfono.',
          details: <String, dynamic>{
            'matches': <Map<String, dynamic>>[
              <String, dynamic>{'id': 3, 'name': 'Marta Ruiz'}
            ],
          },
        );
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.enterText(campo('Nombre *'), 'Otra Persona');
    await tester.enterText(campo('Teléfono *'), '5512345678');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('Teléfono repetido'), findsOneWidget);
    expect(find.textContaining('Marta Ruiz'), findsOneWidget);

    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(altas, 2);
    expect(find.text('Cliente registrado correctamente.'), findsOneWidget);
  });

  testWidgets('test_no_guarda_si_el_usuario_cancela_la_advertencia_de_telefono', (WidgetTester tester) async {
    int altas = 0;
    final FakeApi api = FakeApi(baseHandler(extra: (RecordedRequest r) {
      if (r.method == 'POST' && r.path == '/clients') {
        altas++;
        return jsonError(409, 'PHONE_DUPLICATE_WARNING', 'Ya existe un cliente con ese teléfono.',
            details: <String, dynamic>{'matches': <Map<String, dynamic>>[]});
      }
      return null;
    }));
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.enterText(campo('Nombre *'), 'Otra Persona');
    await tester.enterText(campo('Teléfono *'), '5512345678');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();
    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();

    expect(altas, 1);
    expect(find.text('Cliente registrado correctamente.'), findsNothing);
  });

  testWidgets('test_pide_confirmacion_al_salir_con_cambios_sin_guardar', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.enterText(campo('Nombre *'), 'Ana');
    await tester.pump(); // reconstruye el formulario para que PopScope vea el cambio
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Salir sin guardar'), findsOneWidget);

    await tester.tap(botonDelDialogo('Cancelar'));
    await tester.pumpAndSettle();
    expect(find.text('Guardar'), findsOneWidget, reason: 'seguía en el formulario');

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();
    expect(find.text('Guardar'), findsNothing, reason: 'salió del formulario');
  });

  FakeHandler conClienteExistente({String role = 'RECEPTIONIST', void Function()? alEditar}) {
    return baseHandler(role: role, extra: (RecordedRequest r) {
      if (r.path == '/clients' && r.method == 'GET') {
        return listOf(<Map<String, dynamic>>[clientJson(id: 1, name: 'Ana Pérez')]);
      }
      if (r.path == '/clients/1' && r.method == 'GET') {
        return jsonData(clientJson(
          id: 1,
          name: 'Ana Pérez',
          email: 'ana@correo.com',
          vehicles: <Map<String, dynamic>>[
            vehicleJson(id: 3, clientId: 1, licensePlate: 'AAA111', brand: 'Nissan', model: 'Versa'),
          ],
        ));
      }
      if (r.path == '/clients/1' && r.method == 'PATCH') {
        alEditar?.call();
        return jsonData(clientJson(id: 1, name: 'Ana Pérez', phone: r.body!['phone'] as String));
      }
      return null;
    });
  }

  testWidgets('test_el_detalle_muestra_los_datos_y_los_vehiculos_del_cliente', (WidgetTester tester) async {
    final FakeApi api = FakeApi(conClienteExistente());
    await abrirComoRol(tester, api);

    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();

    expect(find.text('ana@correo.com'), findsOneWidget);
    expect(find.text('AAA111'), findsOneWidget);
    expect(find.text('Nissan Versa'), findsOneWidget);
    expect(find.text('Editar'), findsOneWidget);
    expect(find.text('Agregar vehículo'), findsOneWidget);
  });

  testWidgets('test_el_mecanico_ve_el_detalle_sin_editar_ni_agregar_vehiculos', (WidgetTester tester) async {
    final FakeApi api = FakeApi(conClienteExistente(role: 'MECHANIC'));
    await abrirComoRol(tester, api);

    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();

    expect(find.text('AAA111'), findsOneWidget);
    expect(find.text('Editar'), findsNothing);
    expect(find.text('Agregar vehículo'), findsNothing);
  });

  testWidgets('test_agregar_vehiculo_desde_el_detalle_preselecciona_al_propietario',
      (WidgetTester tester) async {
    final FakeApi api = FakeApi(conClienteExistente());
    await abrirComoRol(tester, api);
    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Agregar vehículo'));
    await tester.pumpAndSettle();

    expect(find.text('Nuevo vehículo'), findsOneWidget);
    expect(find.textContaining('Ana Pérez · 5512345678'), findsOneWidget);
  });

  testWidgets('test_edita_el_telefono_de_un_cliente_existente', (WidgetTester tester) async {
    int ediciones = 0;
    final FakeApi api = FakeApi(conClienteExistente(alEditar: () => ediciones++));
    await abrirComoRol(tester, api);
    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();

    expect(find.text('Editar cliente'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Ana Pérez'), findsOneWidget,
        reason: 'el formulario debía venir con los datos actuales');

    await tester.enterText(campo('Teléfono *'), '5599999999');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(ediciones, 1);
    final RecordedRequest patch = api.requests.firstWhere((RecordedRequest r) => r.method == 'PATCH');
    expect(patch.path, '/clients/1');
    expect(patch.body!['phone'], '5599999999');
    expect(find.text('Cliente actualizado correctamente.'), findsOneWidget);
    expect(find.text('Detalle del cliente'), findsOneWidget, reason: 'volvió al detalle');
  });

  testWidgets('test_la_edicion_con_datos_invalidos_no_llama_al_servidor', (WidgetTester tester) async {
    int ediciones = 0;
    final FakeApi api = FakeApi(conClienteExistente(alEditar: () => ediciones++));
    await abrirComoRol(tester, api);
    await tester.tap(find.text('Ana Pérez'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Editar'));
    await tester.pumpAndSettle();

    await tester.enterText(campo('Teléfono *'), '123');
    await tester.tap(find.text('Guardar'));
    await tester.pumpAndSettle();

    expect(find.text('El teléfono debe tener entre 7 y 15 dígitos.'), findsOneWidget);
    expect(ediciones, 0);
  });

  testWidgets('test_sale_sin_confirmar_cuando_no_hay_cambios', (WidgetTester tester) async {
    final FakeApi api = FakeApi(baseHandler());
    await abrirComoRol(tester, api);
    await abrirFormularioNuevo(tester);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Salir sin guardar'), findsNothing);
    expect(find.text('Guardar'), findsNothing);
  });
}
