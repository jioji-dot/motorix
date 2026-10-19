import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s2.dart';
import '../helpers/test_app.dart';

/// Se desplaza hasta el elemento y lo toca, como haría una persona con la pantalla larga.
Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

// El usuario de la API simulada tiene siempre id 1: una orden con mechanicId 1 está "asignada" al mecánico de la sesión.
Future<ApiTaller> abrirOrden(
  WidgetTester tester, {
  String rol = 'MECHANIC',
  String estado = 'EN_REPARACION',
  int mechanicId = 1,
  List<Map<String, dynamic>>? servicios,
  List<Map<String, dynamic>>? manoDeObra,
}) async {
  final orden = ordenJson(7, estado: estado, mechanicId: mechanicId, servicios: servicios, manoDeObra: manoDeObra);
  final api = ApiTaller(
    rol: rol,
    clientes: [clienteJson(1, 'Roberto Hernández')],
    vehiculos: [vehiculoJson(1, 1, 'ABC-123-A')],
    ordenes: [orden],
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.byTooltip('Órdenes de servicio').first);
  await tester.pumpAndSettle();
  await tester.tap(find.text('OS-000007'));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  group('Quién puede documentar', () {
    testWidgets('el_mecanico_asignado_ve_las_acciones_de_documentacion_en_una_orden_en_curso', (tester) async {
      await abrirOrden(tester);
      expect(find.widgetWithText(OutlinedButton, 'Editar trabajo'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Agregar servicio'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Agregar mano de obra'), findsOneWidget);
      expect(find.text('Editar datos de la orden'), findsNothing);
    });

    testWidgets('recepcion_no_ve_la_documentacion_pero_si_editar_los_datos_de_la_orden', (tester) async {
      await abrirOrden(tester, rol: 'RECEPTIONIST', mechanicId: 3);
      expect(find.text('Editar trabajo'), findsNothing);
      expect(find.text('Agregar servicio'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Editar datos de la orden'), findsOneWidget);
    });

    testWidgets('otro_mecanico_no_ve_las_acciones_de_documentacion', (tester) async {
      await abrirOrden(tester, mechanicId: 3);
      expect(find.text('Editar trabajo'), findsNothing);
      expect(find.text('Agregar servicio'), findsNothing);
    });

    testWidgets('el_administrador_puede_documentar_cualquier_orden_en_curso', (tester) async {
      await abrirOrden(tester, rol: 'ADMIN', mechanicId: 3);
      expect(find.widgetWithText(OutlinedButton, 'Editar trabajo'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Editar datos de la orden'), findsOneWidget);
    });

    for (final estado in ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      testWidgets('la_orden_en_estado_${estado}_es_de_solo_lectura_para_el_mecanico_asignado', (tester) async {
        await abrirOrden(tester, estado: estado, servicios: [servicioJson(1, 'Filtro de aire', '120.50')]);
        expect(find.text('Filtro de aire'), findsOneWidget);
        expect(find.text('Editar trabajo'), findsNothing);
        expect(find.text('Agregar servicio'), findsNothing);
        expect(find.text('Agregar mano de obra'), findsNothing);
        expect(find.byTooltip('Quitar servicio'), findsNothing);
        expect(find.byTooltip('Editar servicio'), findsNothing);
      });
    }
  });

  group('Diagnóstico, observaciones y recomendaciones', () {
    testWidgets('guarda_el_diagnostico_las_observaciones_y_las_recomendaciones', (tester) async {
      final api = await abrirOrden(tester);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Editar trabajo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-diagnostico')), 'Falla en la bomba de agua');
      await tester.enterText(find.byKey(const Key('campo-observaciones')), 'Corrosión en mangueras');
      await tester.enterText(find.byKey(const Key('campo-recomendaciones')), 'Cambiar mangueras');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('PATCH', '/api/orders/7').single.body) as Map<String, dynamic>;
      expect(envio, containsPair('diagnosis', 'Falla en la bomba de agua'));
      expect(envio, containsPair('notes', 'Corrosión en mangueras'));
      expect(envio, containsPair('recommendations', 'Cambiar mangueras'));
      expect(find.text('Trabajo documentado guardado.'), findsOneWidget);
      expect(find.text('Falla en la bomba de agua'), findsOneWidget);
    });

    testWidgets('cancelar_la_edicion_con_cambios_pide_confirmacion', (tester) async {
      final api = await abrirOrden(tester);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Editar trabajo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-diagnostico')), 'Algo');
      await tester.pump();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Salir sin guardar'), findsOneWidget);
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('campo-diagnostico')), findsNothing);
      expect(api.enviadas('PATCH', '/api/orders/7'), isEmpty);
    });
  });

  group('Servicios', () {
    testWidgets('valida_la_descripcion_y_el_importe_en_espanol', (tester) async {
      final api = await abrirOrden(tester);

      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Agregar servicio'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('La descripción es obligatoria.'), findsOneWidget);
      expect(find.text('El importe es obligatorio.'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Cambio de aceite');
      await tester.enterText(find.byKey(const Key('campo-importe')), '-5');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('El importe no puede ser menor a 0.'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('campo-importe')), '10.123');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('El importe puede tener hasta dos decimales.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/orders/7/services'), isEmpty);
    });

    testWidgets('agrega_un_servicio_y_el_total_se_actualiza_en_pantalla', (tester) async {
      final api = await abrirOrden(tester);

      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Agregar servicio'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Cambio de aceite');
      await tester.enterText(find.byKey(const Key('campo-importe')), '450');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/orders/7/services').single.body) as Map<String, dynamic>;
      expect(alta, containsPair('description', 'Cambio de aceite'));
      expect(alta['amount'], 450);
      expect(find.text('Cambio de aceite'), findsOneWidget);
      expect(find.text('\$450.00'), findsWidgets);
      expect(find.text('Servicio agregado.'), findsOneWidget);
    });

    testWidgets('edita_un_servicio_y_actualiza_el_total', (tester) async {
      final api = await abrirOrden(tester, servicios: [servicioJson(1, 'Filtro de aire', '120.50')]);

      await tocarVisible(tester, find.byTooltip('Editar servicio'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-importe')), '200');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('PATCH', '/api/orders/7/services/1'), hasLength(1));
      expect(find.text('\$200.00'), findsWidgets);
      expect(find.text('Servicio actualizado.'), findsOneWidget);
    });

    testWidgets('quitar_un_servicio_pide_confirmacion', (tester) async {
      final api = await abrirOrden(tester, servicios: [servicioJson(1, 'Filtro de aire', '120.50')]);

      await tocarVisible(tester, find.byTooltip('Quitar servicio'));
      await tester.pumpAndSettle();
      expect(find.text('Quitar servicio'), findsWidgets);
      await tester.tap(find.text('Cancelar').last);
      await tester.pumpAndSettle();
      expect(api.enviadas('DELETE', '/api/orders/7/services/1'), isEmpty);

      await tocarVisible(tester, find.byTooltip('Quitar servicio'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('DELETE', '/api/orders/7/services/1'), hasLength(1));
      expect(find.text('Filtro de aire'), findsNothing);
      expect(find.text('Sin servicios registrados'), findsOneWidget);
      expect(find.text('Servicio quitado.'), findsOneWidget);
    });
  });

  group('Mano de obra', () {
    testWidgets('valida_horas_y_tarifa', (tester) async {
      await abrirOrden(tester);

      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Agregar mano de obra'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('El número de horas es obligatorio.'), findsOneWidget);
      expect(find.text('El valor de la tarifa por hora es obligatorio.'), findsOneWidget);

      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Trabajo');
      await tester.enterText(find.byKey(const Key('campo-horas')), '0');
      await tester.enterText(find.byKey(const Key('campo-tarifa')), '300');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('El número de horas no puede ser menor a 0.01.'), findsOneWidget);
    });

    testWidgets('agrega_mano_de_obra_y_muestra_el_importe_calculado_y_el_total', (tester) async {
      final api = await abrirOrden(tester);

      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Agregar mano de obra'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Desmontaje y montaje');
      await tester.enterText(find.byKey(const Key('campo-horas')), '2.5');
      await tester.enterText(find.byKey(const Key('campo-tarifa')), '300');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final alta = jsonDecode(api.enviadas('POST', '/api/orders/7/labor').single.body) as Map<String, dynamic>;
      expect(alta['hours'], 2.5);
      expect(alta['hourlyRate'], 300);
      expect(find.text('Desmontaje y montaje'), findsOneWidget);
      expect(find.text('\$750.00'), findsWidgets);
      expect(find.text('Mano de obra agregada.'), findsOneWidget);
    });

    testWidgets('quitar_mano_de_obra_pide_confirmacion_y_recalcula', (tester) async {
      final api = await abrirOrden(tester, manoDeObra: [manoDeObraJson(1, 'Desmontaje', '2.00', '300.00', '600.00')]);

      await tocarVisible(tester, find.byTooltip('Quitar mano de obra'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(api.enviadas('DELETE', '/api/orders/7/labor/1'), hasLength(1));
      expect(find.text('Sin mano de obra registrada'), findsOneWidget);
    });
  });

  group('Datos de la orden (recepción)', () {
    testWidgets('recepcion_reasigna_el_mecanico_y_corrige_el_problema_reportado', (tester) async {
      final api = await abrirOrden(tester, rol: 'RECEPTIONIST', estado: 'RECIBIDO', mechanicId: 3);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Editar datos de la orden'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('campo-mecanico')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ana Mecánica').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-problema')), 'Ruido al frenar');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('PATCH', '/api/orders/7').single.body) as Map<String, dynamic>;
      expect(envio, containsPair('mechanicId', 4));
      expect(envio, containsPair('reportedProblem', 'Ruido al frenar'));
      expect(find.text('Datos de la orden actualizados.'), findsOneWidget);
    });
  });

  group('Errores de la API', () {
    testWidgets('si_la_orden_ya_no_esta_en_curso_se_muestra_el_mensaje_de_la_api', (tester) async {
      final api = await abrirOrden(tester);
      api.sobrescribir = (p) => p.method == 'POST' && p.url.path == '/api/orders/7/services'
          ? jsonResponse(409, {
              'error': {'code': 'ORDER_NOT_EDITABLE', 'message': 'La orden ya no está en curso y no admite cambios.'},
            })
          : null;

      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Agregar servicio'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-descripcion')), 'Algo');
      await tester.enterText(find.byKey(const Key('campo-importe')), '10');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('La orden ya no está en curso y no admite cambios.'), findsOneWidget);
    });
  });
}
