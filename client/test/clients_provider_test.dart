import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/api_error.dart';
import 'package:motorix_client/models/client.dart';
import 'package:motorix_client/providers/clients_provider.dart';
import 'package:motorix_client/services/clients_service.dart';

import 'helpers/fake_api.dart';

ClientsProvider crearProvider(FakeApi api) => ClientsProvider(ClientsService(api.client));

void main() {
  test('test_carga_el_listado_con_su_paginacion', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => listOf(
          <Map<String, dynamic>>[clientJson(id: 1), clientJson(id: 2, name: 'Luis Gómez')],
          total: 45,
        ));
    final ClientsProvider provider = crearProvider(api);

    await provider.load();

    expect(provider.result!.items, hasLength(2));
    expect(provider.result!.total, 45);
    expect(provider.result!.totalPages, 3);
    expect(provider.result!.hasNext, isTrue);
    expect(provider.error, isNull);
  });

  test('test_envia_la_busqueda_y_la_pagina_al_servidor', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => emptyList());
    final ClientsProvider provider = crearProvider(api);

    await provider.load(page: 2, search: '  gómez ');

    expect(api.requests.single.query['search'], 'gómez');
    expect(api.requests.single.query['page'], '2');
    expect(provider.search, 'gómez');
  });

  test('test_un_error_del_servidor_se_expone_como_mensaje', () async {
    final FakeApi api = FakeApi(
        (RecordedRequest r) => jsonError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.'));
    final ClientsProvider provider = crearProvider(api);

    await provider.load();

    expect(provider.result, isNull);
    expect(provider.error, 'Ocurrió un error inesperado.');
    expect(provider.loading, isFalse);
  });

  test('test_carga_el_detalle_con_los_vehiculos_asociados', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(clientJson(
          id: 7,
          vehicles: <Map<String, dynamic>>[vehicleJson(clientId: 7, licensePlate: 'AAA111')],
        )));
    final ClientsProvider provider = crearProvider(api);

    await provider.loadDetail(7);

    expect(provider.detail!.id, 7);
    expect(provider.detail!.vehicles.single.licensePlate, 'AAA111');
    expect(provider.detailError, isNull);
  });

  test('test_el_detalle_de_un_cliente_inexistente_muestra_el_error', () async {
    final FakeApi api =
        FakeApi((RecordedRequest r) => jsonError(404, 'NOT_FOUND', 'El cliente no existe.'));
    final ClientsProvider provider = crearProvider(api);

    await provider.loadDetail(99);

    expect(provider.detail, isNull);
    expect(provider.detailError, 'El cliente no existe.');
  });

  test('test_el_alta_envia_los_datos_y_la_confirmacion_de_telefono_solo_si_se_pide', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(clientJson(), status: 201));
    final ClientsProvider provider = crearProvider(api);
    const ClientInput datos =
        ClientInput(name: 'Ana Pérez', phone: '5512345678', email: 'ana@correo.com');

    await provider.create(datos);
    await provider.create(datos, confirmDuplicatePhone: true);

    expect(api.requests[0].method, 'POST');
    expect(api.requests[0].body, <String, dynamic>{
      'name': 'Ana Pérez',
      'phone': '5512345678',
      'email': 'ana@correo.com',
      'address': null,
    });
    expect(api.requests[1].body!['confirmDuplicatePhone'], isTrue);
  });

  test('test_el_alta_propaga_la_advertencia_de_telefono_duplicado', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonError(
          409,
          'PHONE_DUPLICATE_WARNING',
          'Ya existe un cliente con ese teléfono.',
          details: <String, dynamic>{
            'matches': <Map<String, dynamic>>[
              <String, dynamic>{'id': 1, 'name': 'Ana Pérez'}
            ],
          },
        ));
    final ClientsProvider provider = crearProvider(api);

    await expectLater(
      provider.create(const ClientInput(name: 'Otra', phone: '5512345678')),
      throwsA(isA<ApiError>().having((ApiError e) => e.code, 'code', 'PHONE_DUPLICATE_WARNING')),
    );
  });

  test('test_la_edicion_usa_patch_sobre_el_cliente_indicado', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(clientJson(phone: '5599999999')));
    final ClientsProvider provider = crearProvider(api);

    final Client editado =
        await provider.update(1, const ClientInput(name: 'Ana Pérez', phone: '5599999999'));

    expect(api.requests.single.method, 'PATCH');
    expect(api.requests.single.path, '/clients/1');
    expect(editado.phone, '5599999999');
  });
}
