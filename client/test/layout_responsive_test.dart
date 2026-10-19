// Verifica que ninguna pantalla desborde con la barra lateral expandida o colapsada y en ventanas angostas
// (criterio de terminado de docs/design-system.md, sección 11).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fake_api.dart';
import 'helpers/fake_api_s2.dart';
import 'helpers/fake_api_s3.dart';
import 'helpers/fake_api_s4.dart';
import 'helpers/test_app.dart';

Future<void> cambiarTamano(WidgetTester tester, double ancho, double alto) async {
  tester.view.physicalSize = Size(ancho, alto);
  tester.view.devicePixelRatio = 1.0;
  await tester.pumpAndSettle();
}

/// Datos con textos largos para provocar desbordamientos si los hubiera.
ApiCobros crearApi() {
  final orden = ordenJson(
    7,
    estado: 'EN_REPARACION',
    cliente: 'Roberto Hernández Cruz de la Fuente y Asociados',
    diagnostico: 'Banda de accesorios desgastada y tensor con juego; se recomienda revisar también el alternador.',
    servicios: [servicioJson(1, 'Banda de accesorios nueva con instalación incluida', '680.00')],
    manoDeObra: [manoDeObraJson(1, 'Cambio de banda y tensor del motor', '1.50', '350.00', '525.00')],
  );
  orden['parts'] = [refaccionDeOrdenJson(1, 1, 'Filtro de aceite de alto rendimiento con empaque incluido', 2, '110.00')];
  orden['total'] = '1425.00';
  final cobrable = ordenJson(
    8,
    estado: 'TERMINADO',
    cliente: 'Roberto Hernández Cruz de la Fuente y Asociados',
    servicios: [servicioJson(1, 'Banda de accesorios nueva con instalación incluida', '1425.00')],
  );
  cobrable['total'] = '1425.00';
  return ApiCobros(
    rol: 'ADMIN',
    clientes: [clienteJson(1, 'Roberto Hernández Cruz de la Fuente y Asociados'), clienteJson(2, 'María Fernanda López Díaz')],
    vehiculos: [
      vehiculoJson(1, 1, 'ABC-123-A', propietario: 'Roberto Hernández Cruz de la Fuente y Asociados'),
      vehiculoJson(2, 2, 'DEF-456-B', propietario: 'María Fernanda López Díaz'),
    ],
    usuarios: [usuarioJson(1, 'admin', 'ADMIN'), usuarioJson(2, 'mecanico', 'MECHANIC', activo: false)],
    citas: [
      citaJson(1, estado: 'CONFIRMADA', motivo: 'Revisión general de frenos, suspensión y dirección del vehículo'),
      citaJson(2, clientId: 2, vehicleId: 2, estado: 'PENDIENTE', cliente: 'María Fernanda López Díaz', placas: 'DEF-456-B'),
    ],
    ordenes: [orden, cobrable],
    pagos: {
      8: [
        pagoJson(1, 8, importe: '500.00', referencia: 'Número de autorización muy largo para provocar desbordamientos 123456'),
        pagoJson(2, 8, importe: '300.00', metodo: 'MERCADO_PAGO', estado: 'PENDIENTE', enlace: 'https://sandbox.mercadopago.test/pagar/una-referencia-muy-larga-para-el-enlace-de-pago'),
      ],
    },
    partes: [
      parteJson(1, 'Filtro de aceite de alto rendimiento con empaque incluido', stock: 25, minimo: 8, categoria: 'Aceites y filtros de alto rendimiento'),
      parteJson(2, 'Disco de freno delantero ventilado', stock: 3, minimo: 4, categoria: 'Frenos'),
      parteJson(3, 'Sensor de oxígeno', stock: 0, minimo: 2, categoria: 'Encendido'),
    ],
    movimientos: {
      1: [movimientoJson(1, 'IN', 25, 25, motivo: 'Compra a proveedor con un motivo bastante largo para provocar desbordamientos')],
    },
    mantenimientos: [
      mantenimientoJson(1, tipo: 'Afinación mayor del motor y revisión general', clasificacion: 'VENCIDO', proximaFecha: '2026-10-01', dias: -18, km: 400, cliente: 'Roberto Hernández Cruz de la Fuente y Asociados'),
      mantenimientoJson(2, vehicleId: 2, clasificacion: 'PROXIMO', proximaFecha: null, proximoKm: 50400, dias: null, km: 400, cliente: 'María Fernanda López Díaz', placas: 'DEF-456-B'),
    ],
    historial: {
      1: [
        historialJson(
          7,
          diagnostico: 'Banda de accesorios desgastada y tensor con juego; se recomienda revisar también el alternador.',
          servicios: [servicioJson(1, 'Banda de accesorios nueva con instalación incluida', '680.00')],
          manoDeObra: [manoDeObraJson(1, 'Cambio de banda y tensor del motor', '1.50', '350.00', '525.00')],
          refacciones: [refaccionDeOrdenJson(1, 1, 'Filtro de aceite de alto rendimiento con empaque incluido', 2, '110.00')],
        ),
      ],
    },
  );
}

void main() {
  const secciones = ['Clientes', 'Vehículos', 'Citas', 'Órdenes de servicio', 'Mantenimientos', 'Inventario', 'Panel de control', 'Usuarios'];

  for (final ancho in [1400.0, 1000.0, 760.0]) {
    testWidgets('las_secciones_no_desbordan_con_ancho_${ancho.toInt()}_y_barra_expandida_o_colapsada', (tester) async {
      await bombearApp(tester, crearApi().call);
      await entrar(tester);
      await cambiarTamano(tester, ancho, 800);

      for (var vuelta = 0; vuelta < 2; vuelta++) {
        for (final seccion in secciones) {
          await tester.tap(find.byTooltip(seccion).first);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: '$seccion a $ancho px (vuelta $vuelta)');
        }
        // Alterna la barra lateral y repite el recorrido.
        final alternar = find.byTooltip(find.byTooltip('Contraer menú').evaluate().isNotEmpty ? 'Contraer menú' : 'Expandir menú');
        await tester.tap(alternar);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
    });
  }

  testWidgets('los_formularios_y_el_detalle_no_desbordan_en_una_ventana_angosta', (tester) async {
    await bombearApp(tester, crearApi().call);
    // Una ventana angosta arranca con la barra lateral colapsada, así que se redimensiona antes de iniciar sesión.
    await cambiarTamano(tester, 600, 700);
    await entrar(tester);

    // Formulario de cliente
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar cliente').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // Detalle de cliente
    await tester.tap(find.text('Roberto Hernández Cruz de la Fuente y Asociados').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // Formulario de vehículo
    await tester.tap(find.byTooltip('Vehículos').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar vehículo').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // Formulario de usuario
    await tester.tap(find.byTooltip('Usuarios').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar usuario').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // Sprint 2: formulario de cita y detalle de cita
    await tester.tap(find.byTooltip('Citas').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar cita').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('15/01/2030 10:00').first); // primera columna (visible en la tabla con desplazamiento)
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // Sprint 2: formulario de orden y detalle de orden (con servicios, mano de obra, acciones e historial)
    await tester.tap(find.byTooltip('Órdenes de servicio').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Nueva orden').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('OS-000007'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(find.text('Historial de estados'), 300, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  for (final ancho in [1400.0, 1000.0, 760.0, 600.0]) {
    testWidgets('las_pantallas_del_sprint_3_no_desbordan_con_ancho_${ancho.toInt()}', (tester) async {
      await bombearApp(tester, crearApi().call);
      // Una ventana angosta arranca con la barra lateral colapsada, así que se redimensiona antes de iniciar sesión.
      await cambiarTamano(tester, ancho, 800);
      await entrar(tester);

      // Historial del vehículo (desde el detalle del vehículo)
      await tester.tap(find.byTooltip('Vehículos').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('ABC-123-A').first);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('boton-historial')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'historial');
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();

      // Inventario: formulario y detalle de refacción, con el diálogo de movimientos
      await tester.tap(find.byTooltip('Inventario').first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'inventario');
      await tester.tap(find.widgetWithText(FilledButton, 'Registrar refacción').first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'formulario de refacción');
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Disco de freno delantero ventilado'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'detalle de refacción');
      await tester.tap(find.byKey(const Key('boton-registrar-movimiento')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'diálogo de movimiento');
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar').last);
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();

      // Mantenimientos: lista y formulario
      await tester.tap(find.byTooltip('Mantenimientos').first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'mantenimientos');
      await tester.tap(find.widgetWithText(FilledButton, 'Programar mantenimiento').first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'formulario de mantenimiento');
      await tester.pageBack();
      await tester.pumpAndSettle();

      // Orden: bloque de refacciones y selector de refacción
      await tester.tap(find.byTooltip('Órdenes de servicio').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('OS-000007'));
      await tester.pumpAndSettle();
      final agregar = find.byKey(const Key('boton-agregar-refaccion'));
      await tester.ensureVisible(agregar);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'refacciones de la orden');
      await tester.tap(agregar);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'selector de refacción');
      await tester.tap(find.byKey(const Key('refaccion-1')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'refacción elegida');
    });
  }

  for (final ancho in [1400.0, 1000.0, 760.0, 600.0]) {
    testWidgets('las_pantallas_del_sprint_4_no_desbordan_con_ancho_${ancho.toInt()}', (tester) async {
      await bombearApp(tester, crearApi().call);
      await cambiarTamano(tester, ancho, 800);
      await entrar(tester);

      // Panel de control
      await tester.tap(find.byTooltip('Panel de control').first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'panel de control');

      // Orden terminada: bloque de pagos, registro de pago, enlace de Mercado Pago y ticket
      await tester.tap(find.byTooltip('Órdenes de servicio').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('OS-000008'));
      await tester.pumpAndSettle();
      final registrar = find.byKey(const Key('boton-registrar-pago'));
      await tester.ensureVisible(registrar);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'bloque de pagos');

      await tester.tap(registrar);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'diálogo de pago');
      await tester.tap(find.byKey(const Key('campo-metodo-pago')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tarjeta').last);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'diálogo de pago con tarjeta');
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar').last);
      await tester.pumpAndSettle();

      final verEnlace = find.byKey(const Key('ver-enlace-2'));
      await tester.ensureVisible(verEnlace);
      await tester.pumpAndSettle();
      await tester.tap(verEnlace);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'enlace de Mercado Pago');
      await tester.tap(find.widgetWithText(FilledButton, 'Listo'));
      await tester.pumpAndSettle();

      final ticket = find.byKey(const Key('boton-ticket'));
      await tester.ensureVisible(ticket);
      await tester.pumpAndSettle();
      await tester.tap(ticket);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'ticket');
    });
  }

  testWidgets('las_acciones_y_los_dialogos_de_la_orden_no_desbordan_en_una_ventana_angosta', (tester) async {
    await bombearApp(tester, crearApi().call);
    await cambiarTamano(tester, 600, 700);
    await entrar(tester);

    await tester.tap(find.byTooltip('Órdenes de servicio').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('OS-000007'));
    await tester.pumpAndSettle();

    for (final accion in ['Agregar servicio', 'Agregar mano de obra']) {
      final boton = find.widgetWithText(OutlinedButton, accion);
      await tester.ensureVisible(boton);
      await tester.pumpAndSettle();
      await tester.tap(boton);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: accion);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Cancelar').last);
      await tester.pumpAndSettle();
    }

    final cancelar = find.widgetWithText(OutlinedButton, 'Cancelar orden');
    await tester.ensureVisible(cancelar);
    await tester.pumpAndSettle();
    await tester.tap(cancelar);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('la_pantalla_de_inicio_de_sesion_no_desborda_en_una_ventana_angosta', (tester) async {
    await bombearApp(tester, ApiSimulada(rol: 'ADMIN').call);
    await cambiarTamano(tester, 360, 640);
    expect(tester.takeException(), isNull);
    expect(find.text('Usuario o correo'), findsOneWidget);
  });
}
