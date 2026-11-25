import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:motorix_client/models/client_notice.dart';
import 'package:motorix_client/providers/client_notices_provider.dart';
import 'package:motorix_client/services/api_client.dart';

import '../helpers/fake_api_s6.dart';

ClientNoticesProvider crear(ApiAvisos api) =>
    ClientNoticesProvider(ApiClient(client: MockClient(api.call), baseUrl: 'http://prueba/api'));

void main() {
  test('carga_la_lista_con_cliente_telefono_vehiculo_y_motivo', () async {
    final provider = crear(ApiAvisos(rol: 'RECEPTIONIST'));
    await provider.load(page: 1);
    expect(provider.error, isNull);
    expect(provider.total, 1);
    final PendingClientNotice h = provider.items.single;
    expect(h.clientName, 'María López');
    expect(h.phone, '5512345678');
    expect(h.reason, 'Vehículo listo');
    expect(h.licensePlate, 'ABC-123-A');
    expect(h.target.kind, 'order');
  });

  test('si_el_servidor_rechaza_al_mecanico_expone_el_mensaje_y_no_deja_datos', () async {
    final provider = crear(ApiAvisos(rol: 'MECHANIC'));
    await provider.load();
    expect(provider.error, 'No tienes permiso para realizar esta acción.');
    expect(provider.items, isEmpty);
  });

  test('marcar_como_avisado_envia_la_nota_recortada_y_saca_al_cliente_de_la_lista', () async {
    final api = ApiAvisos(rol: 'RECEPTIONIST');
    final provider = crear(api);
    await provider.load();
    final mensaje = await provider.markNoticed(provider.items.single, note: '  No contestó  ');
    expect(mensaje, isNull);
    expect(provider.items, isEmpty);
    expect(provider.total, 0);
    expect(api.enviadas('POST', '/api/client-notices').single.body, contains('"note":"No contestó"'));
  });

  test('una_nota_vacia_no_se_envia', () async {
    final api = ApiAvisos(rol: 'RECEPTIONIST');
    final provider = crear(api);
    await provider.load();
    await provider.markNoticed(provider.items.single, note: '   ');
    expect(api.enviadas('POST', '/api/client-notices').single.body, isNot(contains('note')));
  });

  test('si_el_hecho_ya_no_aplica_devuelve_el_mensaje_y_actualiza_la_lista', () async {
    final api = ApiAvisos(rol: 'RECEPTIONIST')..hechoYaNoAplica = true;
    final provider = crear(api);
    await provider.load();
    final mensaje = await provider.markNoticed(provider.items.single);
    expect(mensaje, contains('ya no aplica'));
    expect(api.enviadas('GET', '/api/client-notices'), hasLength(2));
  });

  test('reset_vacia_el_estado', () async {
    final provider = crear(ApiAvisos(rol: 'ADMIN'));
    await provider.load();
    provider.reset();
    expect(provider.items, isEmpty);
    expect(provider.total, 0);
    expect(provider.page, 1);
  });
}
