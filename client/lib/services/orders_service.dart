import '../models/order_status.dart';
import '../models/paged_result.dart';
import '../models/service_order.dart';
import 'api_client.dart';

/// Llamadas a `/api/orders`.
class OrdersService {
  OrdersService(this._api);

  final ApiClient _api;

  Future<PagedResult<ServiceOrder>> list({
    String? search,
    String? status,
    int? mechanicId,
    bool dueOnly = false,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/orders',
      query: <String, dynamic>{
        'search': search,
        'status': status,
        'mechanicId': mechanicId,
        'paymentStatus': dueOnly ? 'DUE' : null,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<ServiceOrder>(
      items: (r.data as List<dynamic>)
          .map((dynamic o) => ServiceOrder.fromJson(o as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  Future<ServiceOrder> get(int id) async {
    final ApiResponse r = await _api.get('/orders/$id');
    return ServiceOrder.fromJson(r.data as Map<String, dynamic>);
  }

  Future<ServiceOrder> create(NewOrderInput input) async {
    final ApiResponse r = await _api.post('/orders', body: input.toJson());
    return ServiceOrder.fromJson(r.data as Map<String, dynamic>);
  }

  /// Mecánicos activos para asignar (solo recepción y administración).
  Future<List<MechanicOption>> mechanics() async {
    final ApiResponse r = await _api.get('/mechanics');
    return (r.data as List<dynamic>)
        .map((dynamic m) => MechanicOption.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  Future<ServiceOrder> updateBasics(int id, OrderBasicsChanges changes) async {
    final ApiResponse r = await _api.patch('/orders/$id', body: changes.toJson());
    return ServiceOrder.fromJson(r.data as Map<String, dynamic>);
  }

  ServiceOrder _order(ApiResponse r) => ServiceOrder.fromJson(r.data as Map<String, dynamic>);

  /// Diagnóstico, observaciones, recomendaciones y kilometraje de servicio. Solo se envían los
  /// campos indicados; un texto vacío los deja sin valor.
  Future<ServiceOrder> updateWork(
    int id, {
    String? diagnosis,
    String? notes,
    String? recommendations,
    int? serviceMileage,
  }) async =>
      _order(await _api.patch(
        '/orders/$id/work',
        body: <String, dynamic>{
          'diagnosis': ?diagnosis,
          'notes': ?notes,
          'recommendations': ?recommendations,
          'serviceMileage': ?serviceMileage,
        },
      ));

  /// Cambia el estado de la orden; el servidor valida la transición y los permisos.
  Future<ServiceOrder> changeStatus(int id, OrderStatus status) async =>
      _order(await _api.post('/orders/$id/status', body: <String, dynamic>{'status': status.apiValue}));

  Future<ServiceOrder> addService(int id, ServiceInput input) async =>
      _order(await _api.post('/orders/$id/services', body: input.toJson()));

  Future<ServiceOrder> updateService(int id, int serviceId, ServiceInput input) async =>
      _order(await _api.patch('/orders/$id/services/$serviceId', body: input.toJson()));

  Future<ServiceOrder> removeService(int id, int serviceId) async =>
      _order(await _api.delete('/orders/$id/services/$serviceId'));

  Future<ServiceOrder> addLabor(int id, LaborInput input) async =>
      _order(await _api.post('/orders/$id/labor', body: input.toJson()));

  Future<ServiceOrder> updateLabor(int id, int laborId, LaborInput input) async =>
      _order(await _api.patch('/orders/$id/labor/$laborId', body: input.toJson()));

  Future<ServiceOrder> removeLabor(int id, int laborId) async =>
      _order(await _api.delete('/orders/$id/labor/$laborId'));

  /// Agrega una refacción a la orden (genera una salida de inventario).
  Future<ServiceOrder> addPart(int id, {required int partId, required int quantity}) async =>
      _order(await _api.post(
        '/orders/$id/parts',
        body: <String, dynamic>{'partId': partId, 'quantity': quantity},
      ));

  Future<ServiceOrder> updatePartQuantity(int id, int orderPartId, int quantity) async =>
      _order(await _api.patch(
        '/orders/$id/parts/$orderPartId',
        body: <String, dynamic>{'quantity': quantity},
      ));

  Future<ServiceOrder> removePart(int id, int orderPartId) async =>
      _order(await _api.delete('/orders/$id/parts/$orderPartId'));
}
