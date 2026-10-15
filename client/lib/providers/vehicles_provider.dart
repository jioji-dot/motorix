import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/history_entry.dart';
import '../models/paged_result.dart';
import '../models/vehicle.dart';
import '../services/vehicles_service.dart';

/// Estado de los vehículos: listado con búsqueda y paginación, detalle, alta y edición.
class VehiclesProvider extends ChangeNotifier {
  VehiclesProvider(this._service);

  final VehiclesService _service;

  PagedResult<Vehicle>? _result;
  String _search = '';
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  Vehicle? _detail;
  bool _detailLoading = false;
  String? _detailError;

  PagedResult<Vehicle>? get result => _result;
  String get search => _search;
  bool get loading => _loading;
  String? get error => _error;

  Vehicle? get detail => _detail;
  bool get detailLoading => _detailLoading;
  String? get detailError => _detailError;

  /// Carga una página del listado. Ignora respuestas de búsquedas anteriores ya reemplazadas.
  Future<void> load({int page = 1, String? search}) async {
    if (search != null) _search = search.trim();
    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PagedResult<Vehicle> pagina = await _service.list(search: _search, page: page);
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

  PagedResult<HistoryEntry>? _history;
  bool _historyLoading = false;
  String? _historyError;
  int _historyRequestId = 0;

  /// Historial de servicios del vehículo abierto en el detalle.
  PagedResult<HistoryEntry>? get history => _history;
  bool get historyLoading => _historyLoading;
  String? get historyError => _historyError;

  Future<void> loadHistory(int vehicleId, {int page = 1}) async {
    final int solicitud = ++_historyRequestId;
    _historyLoading = true;
    _historyError = null;
    if (page == 1) _history = null;
    notifyListeners();
    try {
      final PagedResult<HistoryEntry> pagina = await _service.fetchHistory(vehicleId, page: page);
      if (solicitud != _historyRequestId) return;
      _history = pagina;
    } on ApiError catch (error) {
      if (solicitud != _historyRequestId) return;
      _historyError = error.message;
    } catch (_) {
      if (solicitud != _historyRequestId) return;
      _historyError = 'El servidor respondió con un formato inesperado.';
    } finally {
      if (solicitud == _historyRequestId) {
        _historyLoading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadDetail(int id) async {
    _detailLoading = true;
    _detailError = null;
    _detail = null;
    notifyListeners();
    try {
      _detail = await _service.get(id);
    } on ApiError catch (error) {
      _detailError = error.message;
    } catch (_) {
      _detailError = 'El servidor respondió con un formato inesperado.';
    } finally {
      _detailLoading = false;
      notifyListeners();
    }
  }

  /// Registra un vehículo. Lanza [ApiError] (propietario inexistente, placa duplicada, etc.).
  Future<Vehicle> create(VehicleInput input) => _service.create(input);

  /// Edita un vehículo. Lanza [ApiError] (por ejemplo `MILEAGE_DECREASE`).
  Future<Vehicle> update(int id, VehicleInput input, {bool mileageCorrection = false}) =>
      _service.update(id, input, mileageCorrection: mileageCorrection);
}
