import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/appointment.dart';
import '../models/order_status.dart';
import '../models/paged_result.dart';
import '../services/appointments_service.dart';

/// Estado de las citas: listado con filtros y paginación, alta, edición y cambios de estado.
class AppointmentsProvider extends ChangeNotifier {
  AppointmentsProvider(this._service);

  final AppointmentsService _service;

  PagedResult<Appointment>? _result;
  String _search = '';
  String? _date;
  AppointmentStatus? _status;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  PagedResult<Appointment>? get result => _result;
  String get search => _search;

  /// Filtro de fecha `YYYY-MM-DD`.
  String? get dateFilter => _date;
  AppointmentStatus? get statusFilter => _status;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasFilters => _search.isNotEmpty || _date != null || _status != null;

  /// Carga una página aplicando los filtros. Los filtros que se pasan reemplazan a los anteriores;
  /// use [clearDate] / [clearStatus] para quitarlos.
  Future<void> load({
    int page = 1,
    String? search,
    String? date,
    bool clearDate = false,
    AppointmentStatus? status,
    bool clearStatus = false,
  }) async {
    if (search != null) _search = search.trim();
    if (clearDate) _date = null;
    if (date != null) _date = date;
    if (clearStatus) _status = null;
    if (status != null) _status = status;

    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PagedResult<Appointment> pagina = await _service.list(
        search: _search,
        date: _date,
        status: _status?.apiValue,
        page: page,
      );
      if (solicitud != _requestId) return;
      _result = pagina;
    } on ApiError catch (error) {
      if (solicitud != _requestId) return;
      _error = error.message;
    } catch (_) {
      if (solicitud != _requestId) return;
      _error = 'El servidor respondió con un formato inesperado.';
    } finally {
      if (solicitud == _requestId) {
        _loading = false;
        notifyListeners();
      }
    }
  }

  /// Registra una cita. Lanza [ApiError] (por ejemplo `APPOINTMENT_DUPLICATE_WARNING`).
  Future<Appointment> create(AppointmentInput input, {bool confirmDuplicate = false}) =>
      _service.create(input, confirmDuplicate: confirmDuplicate);

  Future<Appointment> confirm(int id) => _service.confirm(id);

  Future<Appointment> cancel(int id) => _service.cancel(id);

  /// Modifica fecha, hora, motivo u observaciones de una cita abierta.
  Future<Appointment> update(int id, AppointmentInput input, {bool confirmDuplicate = false}) =>
      _service.update(id, input, confirmDuplicate: confirmDuplicate);
}
