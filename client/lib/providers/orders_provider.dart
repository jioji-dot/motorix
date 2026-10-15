import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/order_status.dart';
import '../models/paged_result.dart';
import '../models/service_order.dart';
import '../services/orders_service.dart';

/// Estado de las órdenes de servicio: listado con filtros, detalle, alta y operaciones de trabajo.
class OrdersProvider extends ChangeNotifier {
  OrdersProvider(this._service);

  final OrdersService _service;

  PagedResult<ServiceOrder>? _result;
  String _search = '';
  OrderStatus? _status;
  int? _mechanicId;
  bool _dueOnly = false;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  ServiceOrder? _detail;
  bool _detailLoading = false;
  String? _detailError;

  PagedResult<ServiceOrder>? get result => _result;
  String get search => _search;
  OrderStatus? get statusFilter => _status;
  int? get mechanicFilter => _mechanicId;

  /// Solo órdenes por cobrar (terminadas o entregadas con saldo pendiente).
  bool get dueFilter => _dueOnly;
  bool get loading => _loading;
  String? get error => _error;
  bool get hasFilters => _search.isNotEmpty || _status != null || _mechanicId != null || _dueOnly;

  ServiceOrder? get detail => _detail;
  bool get detailLoading => _detailLoading;
  String? get detailError => _detailError;

  /// Carga una página aplicando los filtros. Los que se pasan reemplazan a los anteriores;
  /// use [clearStatus] / [clearMechanic] para quitarlos.
  Future<void> load({
    int page = 1,
    String? search,
    OrderStatus? status,
    bool clearStatus = false,
    int? mechanicId,
    bool clearMechanic = false,
    bool? dueOnly,
  }) async {
    if (dueOnly != null) _dueOnly = dueOnly;
    if (search != null) _search = search.trim();
    if (clearStatus) _status = null;
    if (status != null) _status = status;
    if (clearMechanic) _mechanicId = null;
    if (mechanicId != null) _mechanicId = mechanicId;

    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PagedResult<ServiceOrder> pagina = await _service.list(
        search: _search,
        status: _status?.apiValue,
        mechanicId: _mechanicId,
        dueOnly: _dueOnly,
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

  /// Registra una orden. Lanza [ApiError] (por ejemplo `MILEAGE_DECREASE`).
  Future<ServiceOrder> create(NewOrderInput input) => _service.create(input);

  /// Mecánicos activos disponibles para asignar.
  Future<List<MechanicOption>> mechanics() => _service.mechanics();

  /// Ejecuta una operación que devuelve la orden actualizada y la deja como detalle vigente.
  Future<ServiceOrder> _apply(Future<ServiceOrder> Function() operacion) async {
    final ServiceOrder actualizada = await operacion();
    _detail = actualizada;
    notifyListeners();
    return actualizada;
  }

  Future<ServiceOrder> updateWork(
    int id, {
    String? diagnosis,
    String? notes,
    String? recommendations,
    int? serviceMileage,
  }) =>
      _apply(() => _service.updateWork(
            id,
            diagnosis: diagnosis,
            notes: notes,
            recommendations: recommendations,
            serviceMileage: serviceMileage,
          ));

  Future<ServiceOrder> changeStatus(int id, OrderStatus status) =>
      _apply(() => _service.changeStatus(id, status));

  Future<ServiceOrder> addService(int id, ServiceInput input) =>
      _apply(() => _service.addService(id, input));

  Future<ServiceOrder> updateService(int id, int serviceId, ServiceInput input) =>
      _apply(() => _service.updateService(id, serviceId, input));

  Future<ServiceOrder> removeService(int id, int serviceId) =>
      _apply(() => _service.removeService(id, serviceId));

  Future<ServiceOrder> addLabor(int id, LaborInput input) =>
      _apply(() => _service.addLabor(id, input));

  Future<ServiceOrder> updateLabor(int id, int laborId, LaborInput input) =>
      _apply(() => _service.updateLabor(id, laborId, input));

  Future<ServiceOrder> removeLabor(int id, int laborId) =>
      _apply(() => _service.removeLabor(id, laborId));

  Future<ServiceOrder> addPart(int id, {required int partId, required int quantity}) =>
      _apply(() => _service.addPart(id, partId: partId, quantity: quantity));

  Future<ServiceOrder> updatePartQuantity(int id, int orderPartId, int quantity) =>
      _apply(() => _service.updatePartQuantity(id, orderPartId, quantity));

  Future<ServiceOrder> removePart(int id, int orderPartId) =>
      _apply(() => _service.removePart(id, orderPartId));

  /// Corrige el problema reportado, el mecánico o el kilometraje de entrada.
  Future<ServiceOrder> updateBasics(int id, OrderBasicsChanges changes) async {
    final ServiceOrder actualizada = await _service.updateBasics(id, changes);
    _detail = actualizada;
    notifyListeners();
    return actualizada;
  }
}
