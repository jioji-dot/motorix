// Verifica que ninguna pantalla desborde con la barra lateral expandida o colapsada y en ventanas angostas
// (criterio de terminado de docs/design-system.md, sección 11).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fake_api.dart';
import 'helpers/test_app.dart';

Future<void> cambiarTamano(WidgetTester tester, double ancho, double alto) async {
  tester.view.physicalSize = Size(ancho, alto);
  tester.view.devicePixelRatio = 1.0;
  await tester.pumpAndSettle();
}

void main() {
  final clientes = [clienteJson(1, 'Roberto Hernández Cruz'), clienteJson(2, 'María Fernanda López Díaz')];
  final vehiculos = [vehiculoJson(1, 1, 'ABC-123-A'), vehiculoJson(2, 2, 'DEF-456-B', propietario: 'María Fernanda López Díaz')];
  final usuarios = [usuarioJson(1, 'admin', 'ADMIN'), usuarioJson(2, 'mecanico', 'MECHANIC', activo: false)];

  for (final ancho in [1400.0, 1000.0, 760.0]) {
    testWidgets('las_secciones_no_desbordan_con_ancho_${ancho.toInt()}_y_barra_expandida_o_colapsada', (tester) async {
      final api = ApiSimulada(rol: 'ADMIN', clientes: clientes, vehiculos: vehiculos, usuarios: usuarios);
      await bombearApp(tester, api.call);
      await entrar(tester);
      await cambiarTamano(tester, ancho, 800);

      for (var vuelta = 0; vuelta < 2; vuelta++) {
        for (final seccion in ['Clientes', 'Vehículos', 'Usuarios']) {
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
    final api = ApiSimulada(rol: 'ADMIN', clientes: clientes, vehiculos: vehiculos, usuarios: usuarios);
    await bombearApp(tester, api.call);
    await entrar(tester);
    await cambiarTamano(tester, 600, 700);

    // Formulario de cliente
    await tester.tap(find.widgetWithText(FilledButton, 'Registrar cliente').first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pageBack();
    await tester.pumpAndSettle();

    // Detalle de cliente
    await tester.tap(find.text('Roberto Hernández Cruz'));
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
  });

  testWidgets('la_pantalla_de_inicio_de_sesion_no_desborda_en_una_ventana_angosta', (tester) async {
    await bombearApp(tester, ApiSimulada(rol: 'ADMIN').call);
    await cambiarTamano(tester, 360, 640);
    expect(tester.takeException(), isNull);
    expect(find.text('Usuario o correo'), findsOneWidget);
  });
}
