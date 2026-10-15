import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/paged_result.dart';
import '../models/part.dart';
import '../services/inventory_service.dart';

/// Estado del inventario: listado con búsqueda, filtro de activas y paginación, y altas/ediciones.
class InventoryProvider extends ChangeNotifier {
  InventoryProvider(this._service);

  final InventoryService _service;

  PagedResult<Part>? _result;
  String _search = '';
  bool? _active;
  AlertFilter? _alert;
  AlertsSummary? _alerts;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  PagedResult<Part>? get result => _result;
  String get search => _search;
  bool? get activeFilter => _active;
  AlertFilter? get alertFilter => _alert;

  /// Conteo de alertas de existencia para la insignia y el aviso (null mientras no se conoce).
  AlertsSummary? get alerts => _alerts;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasFilters => _search.isNotEmpty || _active != null || _alert != null;

  /// Carga una página aplicando los filtros. Los que se pasan reemplazan a los anteriores;
  /// use [clearActive] o [clearAlert] para quitar un filtro.
  Future<void> load({
    int page = 1,
    String? search,
    bool? active,
    bool clearActive = false,
    AlertFilter? alert,
    bool clearAlert = false,
  }) async {
    if (search != null) _search = search.trim();
    if (clearActive) _active = null;
    if (active != null) _active = active;
    if (clearAlert) _alert = null;
    if (alert != null) _alert = alert;

    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PagedResult<Part> pagina = await _service.list(
        search: _search,
        active: _active,
        alert: _alert,
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

  /// Consulta el conteo de alertas. Es informativo: si falla se conserva el último valor conocido.
  Future<void> refreshAlerts() async {
    try {
      _alerts = await _service.alerts();
      notifyListeners();
    } catch (_) {
      // La insignia es secundaria; un error no debe interrumpir el trabajo del usuario.
    }
  }

  /// Ejecuta una operación que cambia el inventario y actualiza el conteo de alertas.
  Future<T> _conAlertas<T>(Future<T> Function() operacion) async {
    final T resultado = await operacion();
    await refreshAlerts();
    return resultado;
  }

  /// Registra una refacción. Lanza [ApiError] (por ejemplo `PART_CODE_DUPLICATE`).
  Future<Part> create(PartInput input) => _conAlertas(() => _service.create(input));

  Future<Part> update(int id, PartInput input) => _conAlertas(() => _service.update(id, input));

  Future<Part> setActive(int id, {required bool active}) =>
      _conAlertas(() => _service.setActive(id, active: active));

  Future<Part> fetchPart(int id) => _service.get(id);

  /// Busca refacciones disponibles para agregarlas a una orden.
  Future<List<AvailablePart>> searchAvailable(String search) => _service.available(search);

  Future<PagedResult<InventoryMovement>> fetchMovements(int id, {int page = 1}) =>
      _service.movements(id, page: page);

  /// Registra una entrada de mercancía. Lanza [ApiError] si los datos no son válidos.
  Future<MovementResult> registerEntry(int id, {required int quantity, required String reason}) =>
      _conAlertas(() => _service.registerEntry(id, quantity: quantity, reason: reason));

  /// Ajusta la existencia a la cantidad contada. Lanza [ApiError] si no hay diferencia.
  Future<MovementResult> registerAdjustment(int id, {required int newStock, required String reason}) =>
      _conAlertas(() => _service.registerAdjustment(id, newStock: newStock, reason: reason));
}
