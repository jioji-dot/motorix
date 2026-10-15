import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/main.dart';

import 'helpers/fake_api.dart';

Future<void> iniciarSesion(WidgetTester tester, String role) async {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  final FakeApi api = FakeApi(baseHandler(role: role));
  await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
  await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
  await tester.tap(find.text('Iniciar sesión'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('test_el_administrador_ve_clientes_vehiculos_citas_ordenes_y_usuarios',
      (WidgetTester tester) async {
    await iniciarSesion(tester, 'ADMIN');

    expect(find.text('Clientes'), findsWidgets);
    expect(find.text('Vehículos'), findsOneWidget);
    expect(find.text('Citas'), findsOneWidget);
    expect(find.text('Órdenes'), findsOneWidget);
    expect(find.text('Usuarios'), findsOneWidget);
    expect(find.text('Mantenimientos'), findsOneWidget);
    expect(find.text('Inventario'), findsOneWidget);
  });

  testWidgets('test_el_recepcionista_ve_citas_y_ordenes_pero_no_usuarios', (WidgetTester tester) async {
    await iniciarSesion(tester, 'RECEPTIONIST');

    expect(find.text('Clientes'), findsWidgets);
    expect(find.text('Vehículos'), findsOneWidget);
    expect(find.text('Citas'), findsOneWidget);
    expect(find.text('Órdenes'), findsOneWidget);
    expect(find.text('Usuarios'), findsNothing);
    expect(find.text('Mantenimientos'), findsOneWidget);
    expect(find.text('Inventario'), findsNothing);
  });

  testWidgets('test_el_mecanico_ve_mis_ordenes_y_no_ve_citas_ni_usuarios', (WidgetTester tester) async {
    await iniciarSesion(tester, 'MECHANIC');

    expect(find.text('Mis órdenes'), findsWidgets);
    expect(find.text('Citas'), findsNothing);
    expect(find.text('Usuarios'), findsNothing);
    expect(find.text('Mantenimientos'), findsNothing);
    expect(find.text('Inventario'), findsNothing);
    expect(find.text('Mecánico'), findsWidgets);
  });

  testWidgets('test_cerrar_sesion_pide_confirmacion_y_permite_cancelar', (WidgetTester tester) async {
    await iniciarSesion(tester, 'RECEPTIONIST');

    await tester.tap(find.text('Cerrar sesión'));
    await tester.pumpAndSettle();

    expect(find.text('¿Seguro que quieres cerrar sesión?'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();

    expect(find.text('Vehículos'), findsOneWidget, reason: 'la sesión debía seguir iniciada');
  });

  testWidgets('test_confirmar_el_cierre_de_sesion_regresa_a_la_pantalla_de_acceso',
      (WidgetTester tester) async {
    await iniciarSesion(tester, 'RECEPTIONIST');

    await tester.tap(find.text('Cerrar sesión'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Confirmar'));
    await tester.pumpAndSettle();

    expect(find.text('Iniciar sesión'), findsWidgets);
    expect(find.text('Usuario o correo electrónico'), findsOneWidget);
  });

  testWidgets('test_con_ventana_angosta_el_sidebar_arranca_colapsado_y_se_puede_expandir',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 700);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    final FakeApi api = FakeApi(baseHandler(role: 'ADMIN'));
    await tester.pumpWidget(MotorixApp(apiClient: api.client, useGoogleFonts: false));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).at(0), 'usuario');
    await tester.enterText(find.byType(TextFormField).at(1), 'Clave2026x');
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Expandir menú'), findsOneWidget, reason: 'debía arrancar colapsado');
    // El sistema de diseño pide ~72 px colapsado y ~260 px expandido.
    expect(tester.getSize(find.byType(NavigationRail)).width, closeTo(72, 8),
        reason: 'colapsado mide ~72 px');
    expect(tester.takeException(), isNull, reason: 'no debía haber desbordes de diseño');

    await tester.tap(find.byTooltip('Expandir menú'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Contraer menú'), findsOneWidget);
    expect(tester.getSize(find.byType(NavigationRail)).width, closeTo(260, 8),
        reason: 'expandido mide ~260 px');
    expect(tester.takeException(), isNull);
  });

  testWidgets('test_el_menu_del_usuario_ofrece_cambiar_la_contrasena', (WidgetTester tester) async {
    await iniciarSesion(tester, 'ADMIN');

    await tester.tap(find.byTooltip('Opciones de la cuenta'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cambiar contraseña'));
    await tester.pumpAndSettle();

    expect(find.text('Contraseña actual'), findsOneWidget);
    expect(find.text('Contraseña nueva'), findsOneWidget);
  });

  Finder enMenu(String texto) => find.descendant(of: find.byType(NavigationRail), matching: find.text(texto));

  testWidgets('test_el_administrador_ve_panel_y_pagos_en_el_menu', (WidgetTester tester) async {
    await iniciarSesion(tester, 'ADMIN');

    expect(enMenu('Panel'), findsOneWidget);
    expect(enMenu('Pagos'), findsOneWidget);
  });

  testWidgets('test_recepcion_ve_pagos_pero_no_el_panel', (WidgetTester tester) async {
    await iniciarSesion(tester, 'RECEPTIONIST');

    expect(enMenu('Pagos'), findsOneWidget);
    expect(enMenu('Panel'), findsNothing);
  });

  testWidgets('test_el_mecanico_no_ve_panel_ni_pagos', (WidgetTester tester) async {
    await iniciarSesion(tester, 'MECHANIC');

    expect(enMenu('Panel'), findsNothing);
    expect(enMenu('Pagos'), findsNothing);
  });

  testWidgets('test_la_pantalla_inicial_depende_del_rol', (WidgetTester tester) async {
    await iniciarSesion(tester, 'ADMIN');
    expect(find.text('Panel de control'), findsOneWidget, reason: 'el administrador inicia en el panel');
  });

  testWidgets('test_recepcion_inicia_en_clientes_y_el_mecanico_en_sus_ordenes', (WidgetTester tester) async {
    await iniciarSesion(tester, 'RECEPTIONIST');
    expect(find.text('Panel de control'), findsNothing);
    expect(find.text('Clientes'), findsWidgets);
  });

  testWidgets('test_el_mecanico_inicia_en_mis_ordenes', (WidgetTester tester) async {
    await iniciarSesion(tester, 'MECHANIC');
    expect(find.text('Panel de control'), findsNothing);
    expect(find.text('Mis órdenes'), findsWidgets);
  });
}
