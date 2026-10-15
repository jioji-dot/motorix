import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/api_error.dart';
import 'package:motorix_client/models/vehicle.dart';
import 'package:motorix_client/providers/vehicles_provider.dart';
import 'package:motorix_client/services/vehicles_service.dart';

import 'helpers/fake_api.dart';

VehiclesProvider crearProvider(FakeApi api) => VehiclesProvider(VehiclesService(api.client));

void main() {
  test('test_carga_el_listado_con_el_nombre_del_propietario', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => listOf(
          <Map<String, dynamic>>[vehicleJson(licensePlate: 'AAA111', ownerName: 'Ana Pérez')],
        ));
    final VehiclesProvider provider = crearProvider(api);

    await provider.load();

    expect(provider.result!.items.single.licensePlate, 'AAA111');
    expect(provider.result!.items.single.ownerName, 'Ana Pérez');
  });

  test('test_envia_la_busqueda_al_servidor', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => emptyList());
    final VehiclesProvider provider = crearProvider(api);

    await provider.load(search: ' aaa-111 ');

    expect(api.requests.single.query['search'], 'aaa-111');
  });

  test('test_el_detalle_incluye_los_datos_del_propietario', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(<String, dynamic>{
          ...vehicleJson(id: 4, clientId: 2),
          'owner': <String, dynamic>{'id': 2, 'name': 'Ana Pérez', 'phone': '5512345678'},
        }));
    final VehiclesProvider provider = crearProvider(api);

    await provider.loadDetail(4);

    expect(provider.detail!.ownerName, 'Ana Pérez');
    expect(provider.detail!.ownerPhone, '5512345678');
    expect(provider.detail!.clientId, 2);
  });

  test('test_el_alta_envia_el_propietario_y_omite_el_kilometraje_si_no_se_captura', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(vehicleJson(), status: 201));
    final VehiclesProvider provider = crearProvider(api);

    await provider.create(const VehicleInput(
      clientId: 3,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2021,
      licensePlate: 'XYZ987',
    ));

    final Map<String, dynamic> cuerpo = api.requests.single.body!;
    expect(cuerpo['clientId'], 3);
    expect(cuerpo.containsKey('currentMileage'), isFalse);
    expect(cuerpo['vin'], isNull);
  });

  test('test_la_edicion_no_envia_el_propietario_y_manda_la_correccion_solo_si_se_pide', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(vehicleJson()));
    final VehiclesProvider provider = crearProvider(api);
    const VehicleInput datos = VehicleInput(
      brand: 'Toyota',
      model: 'Corolla',
      year: 2021,
      licensePlate: 'XYZ987',
      currentMileage: 100,
    );

    await provider.update(1, datos);
    await provider.update(1, datos, mileageCorrection: true);

    expect(api.requests[0].method, 'PATCH');
    expect(api.requests[0].body!.containsKey('clientId'), isFalse);
    expect(api.requests[0].body!.containsKey('mileageCorrection'), isFalse);
    expect(api.requests[1].body!['mileageCorrection'], isTrue);
  });

  test('test_la_placa_duplicada_se_propaga_como_error_del_servidor', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonError(
          409,
          'DUPLICATE_LICENSE_PLATE',
          'Ya existe un vehículo con esa placa.',
          details: <String, dynamic>{'field': 'licensePlate'},
        ));
    final VehiclesProvider provider = crearProvider(api);

    await expectLater(
      provider.create(const VehicleInput(
        clientId: 1,
        brand: 'Kia',
        model: 'Rio',
        year: 2019,
        licensePlate: 'AAA111',
      )),
      throwsA(isA<ApiError>().having((ApiError e) => e.code, 'code', 'DUPLICATE_LICENSE_PLATE')),
    );
  });
}
