import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_api.dart';
import '../helpers/fake_api_s3.dart';
import '../helpers/test_app.dart';

Future<ApiInventario> abrirInventario(
  WidgetTester tester, {
  String rol = 'ADMIN',
  List<Map<String, dynamic>>? partes,
  Map<int, List<Map<String, dynamic>>>? movimientos,
}) async {
  final api = ApiInventario(
    rol: rol,
    partes: partes ??
        [
          parteJson(1, 'Filtro de aceite', stock: 25, minimo: 8),
          parteJson(2, 'Balatas delanteras', stock: 12, minimo: 4, categoria: 'Frenos', precioVenta: '690.00', precioCompra: '420.00'),
        ],
    movimientos: movimientos ??
        {
          1: [movimientoJson(1, 'IN', 25, 25)],
          2: [movimientoJson(2, 'IN', 12, 12)],
        },
  );
  await bombearApp(tester, api.call);
  await entrar(tester);
  await tester.tap(find.text('Inventario').first);
  await tester.pumpAndSettle();
  return api;
}

Future<void> tocarVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
}

void main() {
  group('Lista de refacciones', () {
    testWidgets('el_administrador_ve_las_refacciones_con_precio_de_compra_y_el_boton_de_registrar', (tester) async {
      await abrirInventario(tester);

      expect(find.text('Filtro de aceite'), findsOneWidget);
      expect(find.text('Balatas delanteras'), findsOneWidget);
      expect(find.text('Precio de compra'), findsOneWidget);
      expect(find.text(r'$420.00'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Registrar refacción'), findsOneWidget);
    });

    for (final rol in ['MECHANIC', 'RECEPTIONIST']) {
      testWidgets('el_rol_${rol}_consulta_sin_precio_de_compra_ni_boton_de_registrar', (tester) async {
        await abrirInventario(tester, rol: rol);

        expect(find.text('Filtro de aceite'), findsOneWidget);
        expect(find.text(r'$690.00'), findsOneWidget);
        expect(find.text('Precio de compra'), findsNothing);
        expect(find.text(r'$420.00'), findsNothing);
        expect(find.widgetWithText(FilledButton, 'Registrar refacción'), findsNothing);
      });
    }

    testWidgets('muestra_el_estado_vacio_con_la_accion_de_registrar_para_el_administrador', (tester) async {
      await abrirInventario(tester, partes: []);

      expect(find.text('Aún no hay refacciones'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Registrar refacción'), findsWidgets);
    });

    testWidgets('buscar_envia_el_texto_al_servidor_y_muestra_el_estado_sin_resultados', (tester) async {
      final api = await abrirInventario(tester);

      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'zzz');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(api.peticiones.any((p) => p.url.path == '/api/parts' && p.url.queryParameters['search'] == 'zzz'), isTrue);
      expect(find.text('No se encontraron refacciones'), findsOneWidget);
    });

    testWidgets('muestra_un_error_en_espanol_con_reintentar_si_falla_la_carga', (tester) async {
      final api = await abrirInventario(tester);
      api.sobrescribir = (p) => (p.url.path == '/api/parts' && p.method == 'GET')
          ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
          : null;
      await tester.tap(find.text('Inventario').first);
      await tester.enterText(find.byKey(const Key('campo-busqueda')), 'x');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.text('Ocurrió un error inesperado. Intenta de nuevo más tarde.'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Reintentar'), findsOneWidget);
    });
  });

  group('Formulario de refacción', () {
    Future<void> abrirFormulario(WidgetTester tester, ApiInventario api) async {
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar refacción').first);
      await tester.pumpAndSettle();
    }

    testWidgets('valida_los_campos_obligatorios_con_mensajes_en_espanol', (tester) async {
      final api = await abrirInventario(tester);
      await abrirFormulario(tester, api);

      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El código es obligatorio.'), findsOneWidget);
      expect(find.text('El nombre es obligatorio.'), findsOneWidget);
      expect(find.text('La categoría es obligatoria.'), findsOneWidget);
      expect(find.text('La marca es obligatoria.'), findsOneWidget);
      expect(find.text('El precio de compra es obligatorio.'), findsOneWidget);
      expect(find.text('El precio de venta es obligatorio.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/parts'), isEmpty);
    });

    testWidgets('valida_el_stock_minimo_y_los_precios', (tester) async {
      final api = await abrirInventario(tester);
      await abrirFormulario(tester, api);

      await tester.enterText(find.byKey(const Key('campo-stock-minimo')), '-1');
      await tester.enterText(find.byKey(const Key('campo-precio-compra')), '10.999');
      await tester.enterText(find.byKey(const Key('campo-precio-venta')), '100000000');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('El stock mínimo debe ser un número entero entre 0 y 1,000,000.'), findsOneWidget);
      expect(find.text('El precio de compra puede tener hasta dos decimales.'), findsOneWidget);
      expect(find.text('El precio de venta no puede ser mayor a 99,999,999.99.'), findsOneWidget);
    });

    testWidgets('guarda_la_refaccion_con_existencia_inicial_y_regresa_a_la_lista', (tester) async {
      final api = await abrirInventario(tester);
      await abrirFormulario(tester, api);

      await tester.enterText(find.byKey(const Key('campo-codigo')), 'BUJ-01');
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Bujía de iridio');
      await tester.enterText(find.byKey(const Key('campo-categoria')), 'Encendido');
      await tester.enterText(find.byKey(const Key('campo-marca')), 'NGK');
      await tester.enterText(find.byKey(const Key('campo-stock-minimo')), '4');
      await tester.enterText(find.byKey(const Key('campo-existencia-inicial')), '9');
      await tester.enterText(find.byKey(const Key('campo-precio-compra')), '120');
      await tester.enterText(find.byKey(const Key('campo-precio-venta')), '210.50');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('POST', '/api/parts').single.body) as Map<String, dynamic>;
      expect(envio, containsPair('code', 'BUJ-01'));
      expect(envio, containsPair('initialStock', 9));
      expect(envio, containsPair('salePrice', 210.5));
      expect(find.text('Refacción registrada correctamente.'), findsOneWidget);
      expect(find.text('Bujía de iridio'), findsOneWidget);
    });

    testWidgets('un_codigo_repetido_muestra_el_error_en_el_campo_codigo', (tester) async {
      final api = await abrirInventario(tester);
      await abrirFormulario(tester, api);

      await tester.enterText(find.byKey(const Key('campo-codigo')), 'REF-001');
      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Otra pieza');
      await tester.enterText(find.byKey(const Key('campo-categoria')), 'Motor');
      await tester.enterText(find.byKey(const Key('campo-marca')), 'Gates');
      await tester.enterText(find.byKey(const Key('campo-stock-minimo')), '1');
      await tester.enterText(find.byKey(const Key('campo-precio-compra')), '10');
      await tester.enterText(find.byKey(const Key('campo-precio-venta')), '20');
      await tocarVisible(tester, find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();

      expect(find.text('Ya existe una refacción con ese código.'), findsOneWidget);
    });

    testWidgets('salir_con_cambios_pide_confirmacion', (tester) async {
      final api = await abrirInventario(tester);
      await abrirFormulario(tester, api);

      await tester.enterText(find.byKey(const Key('campo-nombre')), 'Algo');
      await tester.pump();
      await tocarVisible(tester, find.widgetWithText(OutlinedButton, 'Cancelar'));
      await tester.pumpAndSettle();

      expect(find.text('Salir sin guardar'), findsOneWidget);
    });
  });

  group('Detalle de refacción y movimientos', () {
    Future<ApiInventario> abrirDetalle(WidgetTester tester, {String rol = 'ADMIN'}) async {
      final api = await abrirInventario(tester, rol: rol);
      await tester.tap(find.text('Filtro de aceite'));
      await tester.pumpAndSettle();
      return api;
    }

    testWidgets('muestra_los_datos_y_el_historial_de_movimientos', (tester) async {
      await abrirDetalle(tester);

      expect(find.text('Stock actual'), findsOneWidget);
      expect(find.text('Movimientos de inventario'), findsOneWidget);
      expect(find.textContaining('Existencia inicial'), findsOneWidget);
      expect(find.text('Precio de compra'), findsOneWidget);
    });

    for (final rol in ['MECHANIC', 'RECEPTIONIST']) {
      testWidgets('el_rol_${rol}_solo_consulta_y_no_ve_el_precio_de_compra', (tester) async {
        await abrirDetalle(tester, rol: rol);

        expect(find.text('Movimientos de inventario'), findsOneWidget);
        expect(find.text('Precio de compra'), findsNothing);
        expect(find.byKey(const Key('boton-registrar-movimiento')), findsNothing);
        expect(find.widgetWithText(OutlinedButton, 'Editar'), findsNothing);
        expect(find.widgetWithText(OutlinedButton, 'Desactivar'), findsNothing);
      });
    }

    testWidgets('el_ajuste_muestra_el_stock_resultante_y_rechaza_dejarlo_negativo', (tester) async {
      final api = await abrirDetalle(tester);

      await tester.tap(find.byKey(const Key('boton-registrar-movimiento')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('campo-tipo-movimiento')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ajuste (diferencia)').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('campo-cantidad')), '-30');
      await tester.enterText(find.byKey(const Key('campo-motivo')), 'Conteo físico');
      await tester.pump();

      expect(find.text('Stock actual: 25 → resultante: -5'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();
      expect(find.text('El stock no puede quedar negativo (disponible: 25).'), findsOneWidget);
      expect(api.enviadas('POST', '/api/parts/1/movements'), isEmpty);

      await tester.enterText(find.byKey(const Key('campo-cantidad')), '-5');
      await tester.pump();
      expect(find.text('Stock actual: 25 → resultante: 20'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();

      final envio = jsonDecode(api.enviadas('POST', '/api/parts/1/movements').single.body) as Map<String, dynamic>;
      expect(envio, {'type': 'ADJUSTMENT', 'quantity': -5, 'reason': 'Conteo físico'});
      expect(find.text('Movimiento registrado.'), findsOneWidget);
      expect(find.textContaining('Conteo físico'), findsOneWidget);
    });

    testWidgets('el_motivo_y_la_cantidad_son_obligatorios', (tester) async {
      final api = await abrirDetalle(tester);

      await tester.tap(find.byKey(const Key('boton-registrar-movimiento')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar'));
      await tester.pumpAndSettle();

      expect(find.text('La cantidad debe ser un número entero.'), findsOneWidget);
      expect(find.text('El motivo es obligatorio.'), findsOneWidget);
      expect(api.enviadas('POST', '/api/parts/1/movements'), isEmpty);
    });

    testWidgets('desactivar_pide_confirmacion_y_reactivar_no', (tester) async {
      final api = await abrirDetalle(tester);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Desactivar'));
      await tester.pumpAndSettle();
      expect(find.text('Desactivar refacción'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Desactivar'));
      await tester.pumpAndSettle();

      expect(jsonDecode(api.enviadas('PATCH', '/api/parts/1').single.body), {'active': false});
      expect(find.text('Refacción desactivada.'), findsOneWidget);
      expect(find.text('Inactiva'), findsWidgets);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Reactivar'));
      await tester.pumpAndSettle();
      expect(find.text('Desactivar refacción'), findsNothing);
      expect(find.text('Refacción reactivada.'), findsOneWidget);
    });
  });
}
