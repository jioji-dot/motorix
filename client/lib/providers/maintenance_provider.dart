import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/maintenance.dart';
import '../models/paged_result.dart';
import '../services/maintenance_service.dart';

/// Estado de los mantenimientos: registro, edición y cierre, y los mantenimientos del vehículo abierto.
class MaintenanceProvider extends ChangeNotifier {
  MaintenanceProvider(this._service);

  final MaintenanceService _service;

  PagedResult<Maintenance>? _result;
  MaintenanceFilter _filter = MaintenanceFilter.alert;
  String _search = '';
  int _warningDays = 30;
  int _warningKm = 1000;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  /// Listado de avisos (recepción y administración).
  PagedResult<Maintenance>? get result => _result;
  MaintenanceFilter get filter => _filter;
  String get search => _search;
  int get warningDays => _warningDays;
  int get warningKm => _warningKm;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasSearch => _search.isNotEmpty;

  /// Carga una página aplicando el filtro y la búsqueda; los valores que se pasan reemplazan a los anteriores.
  Future<void> load({int page = 1, MaintenanceFilter? filter, String? search}) async {
    if (filter != null) _filter = filter;
    if (search != null) _search = search.trim();

    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final MaintenanceListResult resultado =
          await _service.list(filter: _filter, search: _search, page: page);
      if (solicitud != _requestId) return;
      _result = resultado.result;
      _warningDays = resultado.warningDays;
      _warningKm = resultado.warningKm;
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

  List<Maintenance>? _vehicleItems;
  bool _vehicleLoading = false;
  String? _vehicleError;
  int _vehicleRequestId = 0;

  /// Mantenimientos del vehículo abierto en el detalle (el pendiente primero).
  List<Maintenance>? get vehicleItems => _vehicleItems;
  bool get vehicleLoading => _vehicleLoading;
  String? get vehicleError => _vehicleError;

  /// Mantenimiento pendiente del vehículo abierto, si lo hay.
  Maintenance? get pending {
    for (final Maintenance m in _vehicleItems ?? <Maintenance>[]) {
      if (m.isPending) return m;
    }
    return null;
  }

  Future<void> loadForVehicle(int vehicleId) async {
    final int solicitud = ++_vehicleRequestId;
    _vehicleLoading = true;
    _vehicleError = null;
    notifyListeners();
    try {
      final List<Maintenance> items = await _service.forVehicle(vehicleId);
      if (solicitud != _vehicleRequestId) return;
      _vehicleItems = items;
    } on ApiError catch (error) {
      if (solicitud != _vehicleRequestId) return;
      _vehicleError = error.message;
    } catch (_) {
      if (solicitud != _vehicleRequestId) return;
      _vehicleError = 'El servidor respondió con un formato inesperado.';
    } finally {
      if (solicitud == _vehicleRequestId) {
        _vehicleLoading = false;
        notifyListeners();
      }
    }
  }

  /// Registra el próximo mantenimiento. Lanza [ApiError] (por ejemplo `MAINTENANCE_PENDING_EXISTS`).
  Future<Maintenance> create(int orderId, MaintenanceInput input, {bool replacePending = false}) =>
      _service.create(orderId, input, replacePending: replacePending);

  Future<Maintenance> update(
    int id, {
    String? description,
    String? nextDate,
    bool clearDate = false,
    int? nextMileage,
    bool clearMileage = false,
  }) =>
      _service.update(
        id,
        description: description,
        nextDate: nextDate,
        clearDate: clearDate,
        nextMileage: nextMileage,
        clearMileage: clearMileage,
      );

  Future<Maintenance> complete(int id) => _service.complete(id);

  Future<Maintenance> cancel(int id) => _service.cancel(id);
}
