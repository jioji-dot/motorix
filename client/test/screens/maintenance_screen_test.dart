import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/test_app.dart';

Future<ApiInventario> abrirMantenimientos(
  WidgetTester tester, {
  String rol = 'RECEPTIONIST',
  List<Map<String, dynamic>>? mantenimientos,
}) async {
  final api = ApiInventario(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    mantenimientos: mantenimientos ??
        [
          mantenimientoJson(1, tipo: 'Afinación mayor', clasificacion: 'VENCIDO', proximaFecha: '2026-10-01', proximoKm: null, dias: -18, km: null),
          mantenimientoJson(2, tipo: 'Cambio de frenos', clasificacion: 'PROXIMO', proximaFecha: null, proximoKm: 50400, dias: null, km: 400),
          mantenimientoJson(3, tipo: 'Cambio de aceite', clasificacion: 'NORMAL', dias: 130, km: 5000),
        ],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Mantenimientos').first);
  await tester.pumpAndSettle();
  return api;
}

void main() {
  group('Lista de mantenimientos', () {
    testWidgets('muestra_la_clasificacion_el_cliente_y_su_telefono_de_contacto', (tester) async {
      await abrirMantenimientos(tester);

      expect(find.text('Vencido'), findsOneWidget);
      expect(find.text('Próximo'), findsWidgets);
      expect(find.text('Normal'), findsOneWidget);
      expect(find.text('Roberto Hernández'), findsWidgets);
      expect(find.text('55 1234 5601'), findsWidgets);
      expect(find.text('Hace 18 días'), findsOneWidget);
      expect(find.text('Faltan 400 km'), findsOneWidget);
      expect(find.text('En 130 días · Faltan 5,000 km'), findsOneWidget);
    });

    testWidgets('recepcion_solo_consulta_y_no_ve_programar_ni_editar', (tester) async {
      await abrirMantenimientos(tester);

      expect(find.widgetWithText(FilledButton, 'Programar mantenimiento'), findsNothing);
      expect(find.byTooltip('Editar'), findsNothing);
    });

    for (final rol in ['MECHANIC', 'ADMIN']) {
      testWidgets('el_rol_${rol}_puede_programar_y_editar', (tester) async {
        await abrirMantenimientos(tester, rol: rol);

        expect(find.widgetWithText(FilledButton, 'Programar mantenimiento'), findsOneWidget);
        expect(find.byTooltip('Editar'), findsWidgets);
      });
    }

    testWidgets('el_filtro_pide_al_servidor_las_clasificaciones_elegidas', (tester) async {
      final api = await abrirMantenimientos(tester);

      await tester.tap(find.byKey(const Key('filtro-clasificacion')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Próximos y vencidos').last);
      await tester.pumpAndSettle();

      expect(
        api.peticiones.any((p) => p.url.path == '/api/maintenance' && p.url.queryParameters['classification'] == 'VENCIDO,PROXIMO'),
        isTrue,
      );
      expect(find.text('Cambio de aceite'), findsNothing);
      expect(find.text('Afinación mayor'), findsOneWidget);
    });

    testWidgets('buscar_envia_el_texto_al_servidor', (tester) async {
      final api = await abrirMantenimientos(tester);

      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'frenos');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(api.peticiones.any((p) => p.url.path == '/api/maintenance' && p.url.queryParameters['search'] == 'frenos'), isTrue);
      expect(find.text('Cambio de frenos'), findsOneWidget);
      expect(find.text('Afinación mayor'), findsNothing);
    });

    testWidgets('sin_mantenimientos_muestra_el_estado_vacio', (tester) async {
      await abrirMantenimientos(tester, mantenimientos: []);

      expect(find.text('No hay mantenimientos pendientes'), findsOneWidget);
    });

    testWidgets('muestra_un_error_en_espanol_con_reintentar_si_falla_la_carga', (tester) async {
      final api = ApiInventario(rol: 'RECEPTIONIST');
      api.sobrescribir = (p) => p.url.path == '/api/maintenance'
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await bombearApp(tester, api.call);
      await entrar(tester);
      await tester.tap(find.text('Mantenimientos').first);
      await tester.pumpAndSettle();

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Reintentar'), findsOneWidget);
    });
  });
}
