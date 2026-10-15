import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/api_error.dart';
import 'package:motorix_client/models/appointment.dart';
import 'package:motorix_client/models/order_status.dart';
import 'package:motorix_client/providers/appointments_provider.dart';
import 'package:motorix_client/services/appointments_service.dart';

import 'helpers/fake_api.dart';

AppointmentsProvider crearProvider(FakeApi api) =>
    AppointmentsProvider(AppointmentsService(api.client));

void main() {
  test('test_carga_el_listado_con_estado_cliente_y_vehiculo', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => listOf(<Map<String, dynamic>>[
          appointmentJson(id: 1, status: 'CONFIRMADA', orderId: 4),
        ]));
    final AppointmentsProvider provider = crearProvider(api);

    await provider.load();

    final Appointment cita = provider.result!.items.single;
    expect(cita.status, AppointmentStatus.confirmed);
    expect(cita.clientName, 'Ana Pérez');
    expect(cita.vehiclePlate, 'ABC123');
    expect(cita.orderId, 4);
    expect(cita.isOpen, isFalse, reason: 'una cita con orden ya no se modifica');
  });

  test('test_envia_los_filtros_de_busqueda_fecha_y_estado_y_los_puede_quitar', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => emptyList());
    final AppointmentsProvider provider = crearProvider(api);

    await provider.load(
      search: ' ana ',
      date: '2030-01-10',
      status: AppointmentStatus.pending,
    );
    expect(api.requests.last.query['search'], 'ana');
    expect(api.requests.last.query['date'], '2030-01-10');
    expect(api.requests.last.query['status'], 'PENDIENTE');
    expect(provider.hasFilters, isTrue);

    await provider.load(search: '', clearDate: true, clearStatus: true);
    expect(api.requests.last.query.containsKey('date'), isFalse);
    expect(api.requests.last.query.containsKey('status'), isFalse);
    expect(provider.hasFilters, isFalse);
  });

  test('test_un_error_del_servidor_se_expone_como_mensaje', () async {
    final FakeApi api = FakeApi(
        (RecordedRequest r) => jsonError(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.'));
    final AppointmentsProvider provider = crearProvider(api);

    await provider.load();

    expect(provider.error, 'No tienes permiso para realizar esta acción.');
    expect(provider.result, isNull);
  });

  test('test_el_alta_envia_los_datos_y_la_confirmacion_solo_si_se_pide', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(appointmentJson(), status: 201));
    final AppointmentsProvider provider = crearProvider(api);
    const AppointmentInput datos = AppointmentInput(
      clientId: 7,
      vehicleId: 3,
      scheduledAt: '2030-01-10T10:00',
      reason: 'Cambio de aceite',
    );

    await provider.create(datos);
    await provider.create(datos, confirmDuplicate: true);

    expect(api.requests[0].method, 'POST');
    expect(api.requests[0].path, '/appointments');
    expect(api.requests[0].body, <String, dynamic>{
      'clientId': 7,
      'vehicleId': 3,
      'scheduledAt': '2030-01-10T10:00',
      'reason': 'Cambio de aceite',
      'notes': null,
    });
    expect(api.requests[1].body!['confirmDuplicate'], isTrue);
  });

  test('test_propaga_la_advertencia_de_cita_coincidente', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonError(
          409,
          'APPOINTMENT_DUPLICATE_WARNING',
          'Ya hay una cita de este vehículo el mismo día.',
          details: <String, dynamic>{
            'matches': <Map<String, dynamic>>[
              <String, dynamic>{'id': 2, 'scheduledAt': '2030-01-10T09:00'}
            ],
          },
        ));
    final AppointmentsProvider provider = crearProvider(api);

    await expectLater(
      provider.create(const AppointmentInput(
        clientId: 1,
        vehicleId: 1,
        scheduledAt: '2030-01-10T16:00',
        reason: 'Frenos',
      )),
      throwsA(isA<ApiError>().having((ApiError e) => e.code, 'code', 'APPOINTMENT_DUPLICATE_WARNING')),
    );
  });

  test('test_la_edicion_usa_patch_y_no_envia_cliente_ni_vehiculo', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(appointmentJson()));
    final AppointmentsProvider provider = crearProvider(api);

    await provider.update(
      5,
      const AppointmentInput(
        clientId: 1,
        vehicleId: 1,
        scheduledAt: '2030-01-11T11:00',
        reason: 'Frenos',
      ),
    );

    expect(api.requests.single.method, 'PATCH');
    expect(api.requests.single.path, '/appointments/5');
    expect(api.requests.single.body!.containsKey('clientId'), isFalse);
    expect(api.requests.single.body!.containsKey('vehicleId'), isFalse);
  });
}
