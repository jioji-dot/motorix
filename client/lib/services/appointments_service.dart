import '../models/appointment.dart';
import '../models/paged_result.dart';
import 'api_client.dart';

/// Llamadas a `/api/appointments` (solo recepción y administración).
class AppointmentsService {
  AppointmentsService(this._api);

  final ApiClient _api;

  Future<PagedResult<Appointment>> list({
    String? search,
    String? date,
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/appointments',
      query: <String, dynamic>{
        'search': search,
        'date': date,
        'status': status,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<Appointment>(
      items: (r.data as List<dynamic>)
          .map((dynamic c) => Appointment.fromJson(c as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  Future<Appointment> get(int id) async {
    final ApiResponse r = await _api.get('/appointments/$id');
    return Appointment.fromJson(r.data as Map<String, dynamic>);
  }

  Future<Appointment> create(AppointmentInput input, {bool confirmDuplicate = false}) async {
    final ApiResponse r = await _api.post(
      '/appointments',
      body: <String, dynamic>{
        ...input.toJson(),
        if (confirmDuplicate) 'confirmDuplicate': true,
      },
    );
    return Appointment.fromJson(r.data as Map<String, dynamic>);
  }

  /// PENDIENTE → CONFIRMADA.
  Future<Appointment> confirm(int id) async {
    final ApiResponse r = await _api.post('/appointments/$id/confirm');
    return Appointment.fromJson(r.data as Map<String, dynamic>);
  }

  /// Cancela la cita (solo sin orden); queda como historial.
  Future<Appointment> cancel(int id) async {
    final ApiResponse r = await _api.post('/appointments/$id/cancel');
    return Appointment.fromJson(r.data as Map<String, dynamic>);
  }

  /// Edita fecha, hora, motivo y observaciones (nunca el cliente ni el vehículo).
  Future<Appointment> update(int id, AppointmentInput input, {bool confirmDuplicate = false}) async {
    final ApiResponse r = await _api.patch(
      '/appointments/$id',
      body: <String, dynamic>{
        'scheduledAt': input.scheduledAt,
        'reason': input.reason,
        'notes': input.notes,
        if (confirmDuplicate) 'confirmDuplicate': true,
      },
    );
    return Appointment.fromJson(r.data as Map<String, dynamic>);
  }
}
