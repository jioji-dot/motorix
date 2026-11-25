import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:motorix_client/providers/notifications_provider.dart';
import 'package:motorix_client/services/api_client.dart';

import '../helpers/fake_api_s6.dart';
import '../helpers/test_app.dart';

/// Provider con una API simulada que cuenta las consultas y permite hacerlas fallar.
class Montaje {
  Montaje() : api = ApiAvisos(rol: 'ADMIN') {
    cliente = ApiClient(client: MockClient((p) async => fallar ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Fallo del servidor.'}}) : api.call(p)), baseUrl: 'http://prueba/api');
    provider = NotificationsProvider(cliente, pollInterval: const Duration(seconds: 60));
  }

  final ApiAvisos api;
  late final ApiClient cliente;
  late final NotificationsProvider provider;
  bool fallar = false;

  int get consultas => api.enviadas('GET', '/api/notifications').length;
}

/// Ejecuta la prueba y descarta el provider al terminar, para que no quede ningún temporizador pendiente.
void probar(String nombre, Future<void> Function(WidgetTester tester, Montaje m) cuerpo, {bool fallaAlInicio = false}) {
  testWidgets(nombre, (tester) async {
    final m = Montaje()..fallar = fallaAlInicio;
    try {
      await cuerpo(tester, m);
    } finally {
      m.provider.dispose();
    }
  });
}

void main() {
  probar('carga_los_avisos_y_expone_los_contadores', (tester, m) async {
    m.provider.start();
    await tester.pump();
    expect(m.provider.unread, 4);
    expect(m.provider.stockAlerts, 1);
    expect(m.provider.clientsToNotify, 1);
    expect(m.provider.data!.groups.map((g) => g.title), contains('Órdenes detenidas'));
  });

  probar('repite_la_consulta_cada_60_segundos', (tester, m) async {
    m.provider.start();
    await tester.pump();
    expect(m.consultas, 1);
    await tester.pump(const Duration(seconds: 59));
    expect(m.consultas, 1);
    await tester.pump(const Duration(seconds: 1));
    expect(m.consultas, 2);
    await tester.pump(const Duration(seconds: 60));
    expect(m.consultas, 3);
  });

  probar('si_falla_una_consulta_periodica_conserva_el_ultimo_numero_sin_error', (tester, m) async {
    m.provider.start();
    await tester.pump();
    m.fallar = true;
    await tester.pump(const Duration(seconds: 60));
    expect(m.provider.unread, 4);
    expect(m.provider.error, isNull);
    m.fallar = false;
    await tester.pump(const Duration(seconds: 60));
    expect(m.provider.unread, 4);
  });

  probar('si_falla_la_primera_consulta_expone_el_mensaje_de_error', fallaAlInicio: true, (tester, m) async {
    m.provider.start();
    await tester.pump();
    expect(m.provider.data, isNull);
    expect(m.provider.error, 'Fallo del servidor.');
    expect(m.provider.unread, 0);
  });

  probar('reset_vacia_el_estado_y_detiene_el_sondeo', (tester, m) async {
    m.provider.start();
    await tester.pump();
    m.provider.reset();
    expect(m.provider.data, isNull);
    expect(m.provider.unread, 0);
    final antes = m.consultas;
    await tester.pump(const Duration(seconds: 180));
    expect(m.consultas, antes);
  });

  probar('marcar_como_leido_baja_el_contador_y_conserva_el_total', (tester, m) async {
    m.provider.start();
    await tester.pump();
    final mensaje = await m.provider.markRead('ORDEN:7');
    await tester.pump();
    expect(mensaje, isNull);
    expect(m.provider.unread, 3);
    expect(m.provider.data!.total, 4);
    expect(m.api.enviadas('POST', '/api/notifications/read'), hasLength(1));
  });

  probar('si_marcar_como_leido_falla_devuelve_el_mensaje_del_servidor', (tester, m) async {
    m.provider.start();
    await tester.pump();
    m.api.sobrescribir = (p) => p.url.path == '/api/notifications/read'
        ? jsonResponse(500, {'error': {'code': 'INTERNAL_ERROR', 'message': 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'}})
        : null;
    final mensaje = await m.provider.markRead('ORDEN:7');
    expect(mensaje, 'Ocurrió un error inesperado. Intenta de nuevo más tarde.');
    expect(m.provider.unread, 4);
  });
}
