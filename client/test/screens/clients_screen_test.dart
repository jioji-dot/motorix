import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/test_app.dart';

void main() {
  group('Lista de clientes', () {
    testWidgets('muestra_los_clientes_devueltos_por_la_api', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [
        clienteJson(1, 'Roberto Hernández'),
        clienteJson(2, 'María López', telefono: '5598765432'),
      ]);
      await bombearApp(tester, api.call);
      await entrar(tester);

      expect(find.text('Roberto Hernández'), findsOneWidget);
      expect(find.text('María López'), findsOneWidget);
      expect(find.text('Activo'), findsWidgets);
    });

    testWidgets('muestra_el_estado_vacio_con_la_accion_de_registrar_para_recepcion', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'RECEPTIONIST').call);
      await entrar(tester);

      expect(find.text('Aún no hay clientes'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Registrar cliente'), findsWidgets);
    });

    testWidgets('muestra_un_error_en_espanol_sin_trazas_y_permite_reintentar', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST');
      api.sobrescribir = (p) => p.url.path == '/api/clients' && p.method == 'GET'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);

      api.sobrescribir = null;
      await tester.tap(find.text('Reintentar'));
      await tester.pumpAndSettle();
      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsNothing);
    });

    testWidgets('el_mecanico_no_ve_el_boton_de_registrar_cliente', (tester) async {
      final api = ApiSimulada(rol: 'MECHANIC', clientes: [clienteJson(1, 'Roberto Hernández')]);
      await bombearApp(tester, api.call);
      await entrar(tester);

      expect(find.text('Roberto Hernández'), findsOneWidget);
      expect(find.text('Registrar cliente'), findsNothing);
    });

    testWidgets('envia_el_texto_de_busqueda_a_la_api', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST', clientes: [clienteJson(1, 'Roberto Hernández')]);
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'rober');
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pumpAndSettle();

      final busquedas = api.peticiones.where((p) => p.url.path == '/api/clients').map((p) => p.url.queryParameters['search']);
      expect(busquedas, contains('rober'));
    });
  });

  group('Formulario de cliente', () {
    testWidgets('exige_nombre_y_telefono_de_10_digitos', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST');
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar cliente').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-telefono')), '123');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El nombre es obligatorio.'), findsOneWidget);
      expect(find.text('El teléfono debe tener 10 dígitos.'), findsOneWidget);
      expect(api.peticiones.where((p) => p.method == 'POST' && p.url.path == '/api/clients'), isEmpty);
    });

    testWidgets('registra_el_cliente_y_regresa_a_la_lista_con_aviso_de_exito', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST');
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar cliente').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Ana Torres');
      await tester.enterText(find.byKey(const Key('campo-telefono')), '55 1234 5678');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = api.peticiones.firstWhere((p) => p.method == 'POST' && p.url.path == '/api/clients');
      expect(jsonDecode(alta.body), containsPair('name', 'Ana Torres'));
      expect(find.text('Cliente registrado correctamente.'), findsOneWidget);
      expect(find.text('Ana Torres'), findsOneWidget);
    });

    testWidgets('pide_confirmacion_si_el_telefono_ya_existe_y_reenvia_confirmado', (tester) async {
      final api = ApiSimulada(rol: 'RECEPTIONIST');
      var intentos = 0;
      api.sobrescribir = (p) {
        if (p.method == 'POST' && p.url.path == '/api/clients') {
          intentos++;
          final cuerpo = jsonDecode(p.body) as Map<String, dynamic>;
          if (cuerpo['confirmDuplicatePhone'] != true) {
            return jsonResponse(409, {
              'error': {
                'code': 'DUPLICATE_PHONE',
                'message': 'Ya existe un cliente con ese teléfono.',
                'details': [
                  {'id': 3, 'name': 'Luis Pérez', 'phone': '5512345678'},
                ],
              },
            });
          }
        }
        return null;
      };
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar cliente').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Ana Torres');
      await tester.enterText(find.byKey(const Key('campo-telefono')), '5512345678');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Luis Pérez'), findsOneWidget);
      expect(find.text('Confirmar'), findsOneWidget);

      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(intentos, 2);
      expect(find.text('Cliente registrado correctamente.'), findsOneWidget);
    });

    testWidgets('pide_confirmacion_al_salir_con_cambios_sin_guardar', (tester) async {
      await bombearApp(tester, ApiSimulada(rol: 'RECEPTIONIST').call);
      await entrar(tester);

      await tester.tap(find.widgetWithText(FilledButton, 'Registrar cliente').first);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Ana');
      await tester.pump(); // un fotograma entre escribir y salir, como en la app real
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Salir sin guardar'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();
      expect(find.text('Salir sin guardar'), findsNothing);
      expect(find.byKey(const Key('campo-nombre')), findsNothing);
    });
  });

  group('Detalle de cliente', () {
    testWidgets('muestra_los_datos_y_los_vehiculos_asociados', (tester) async {
      final api = ApiSimulada(
        rol: 'RECEPTIONIST',
        clientes: [clienteJson(1, 'Roberto Hernández')],
        vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
      );
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.tap(find.text('Roberto Hernández'));
      await tester.pumpAndSettle();

      expect(find.text('Vehículos'), findsWidgets);
      expect(find.text('ABC-123-A'), findsOneWidget);
      expect(find.textContaining('Nissan'), findsOneWidget);
    });

    testWidgets('el_mecanico_ve_el_detalle_sin_acciones_de_edicion', (tester) async {
      final api = ApiSimulada(
        rol: 'MECHANIC',
        clientes: [clienteJson(1, 'Roberto Hernández')],
        vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
      );
      await bombearApp(tester, api.call);
      await entrar(tester);

      await tester.tap(find.text('Roberto Hernández'));
      await tester.pumpAndSettle();

      expect(find.text('ABC-123-A'), findsOneWidget);
      expect(find.text('Editar'), findsNothing);
      expect(find.text('Desactivar'), findsNothing);
    });
  });
}
