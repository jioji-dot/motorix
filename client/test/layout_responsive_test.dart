// Verifica que ninguna pantalla desborde con la barra lateral expandida o colapsada y en ventanas angostas
// (criterio de terminado de docs/design-system.md, sección 11).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fake_api.dart';
import 'helpers/fake_api_s2.dart';
import 'helpers/test_app.dart';

Future<void> cambiarTamano(WidgetTester tester, double ancho, double alto) async {
  tester.view.physicalSize = Size(ancho, alto);
  tester.view.devicePixelRatio = 1.0;
  await tester.pumpAndSettle();
}

/// Datos con textos largos para provocar desbordamientos si los hubiera.
ApiTaller crearApi() {
  final orden = ordenJson(
    7,
    estado: 'EN_REPARACION',
    cliente: 'Roberto Hernández Cruz de la Fuente y Asociados',
    diagnostico: 'Banda de accesorios desgastada y tensor con juego; se recomienda revisar también el alternador.',
    servicios: [servicioJson(1, 'Banda de accesorios nueva con instalación incluida', '680.00')],
    manoDeObra: [manoDeObraJson(1, 'Cambio de banda y tensor del motor', '1.50', '350.00', '525.00')],
  );
  orden['total'] = '1205.00';
  return ApiTaller(
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
    ordenes: [orden],
  );
}

void main() {
  const secciones = ['Clientes', 'Vehículos', 'Citas', 'Órdenes de servicio', 'Usuarios'];

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
