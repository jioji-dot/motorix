import 'package:flutter/foundation.dart';

import '../models/service_order.dart';
import '../services/api_client.dart';

/// Estado del listado de órdenes de servicio y operaciones sobre ellas.
class OrdersProvider extends ChangeNotifier {
  OrdersProvider(this.api);

  final ApiClient api;

  List<ServiceOrder> items = [];
  int total = 0;
  int page = 1;
  final int pageSize = 20;
  String search = '';
  String? statusFilter;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    total = 0;
    page = 1;
    search = '';
    statusFilter = null;
    loading = false;
    error = null;
    notifyListeners();
  }

  Future<void> load({int? page}) async {
    if (page != null) this.page = page;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final respuesta = await api.get('/orders', query: {
        'search': search.trim(),
        'status': statusFilter,
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((o) => ServiceOrder.fromJson(o as Map<String, dynamic>)).toList();
      total = (respuesta['meta'] as Map<String, dynamic>)['total'] as int;
    } on ApiException catch (e) {
      error = e.message;
      items = [];
    } catch (_) {
      error = 'No se pudo leer la respuesta del servidor. Intenta de nuevo.';
      items = [];
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void setSearch(String valor) {
    search = valor;
    load(page: 1);
  }

  void setStatusFilter(String? valor) {
    statusFilter = valor;
    load(page: 1);
  }

  /// Mecánicos activos para asignar la orden (solo recepción y administración).
  Future<List<Mechanic>> mechanics() async {
    final respuesta = await api.get('/mechanics') as Map<String, dynamic>;
    return (respuesta['data'] as List).map((m) => Mechanic.fromJson(m as Map<String, dynamic>)).toList();
  }

  ServiceOrder _orden(dynamic respuesta) =>
      ServiceOrder.fromJson((respuesta as Map<String, dynamic>)['data'] as Map<String, dynamic>);

  Future<ServiceOrder> fetchDetail(int id) async => _orden(await api.get('/orders/$id'));

  Future<ServiceOrder> create(Map<String, dynamic> datos) async => _orden(await api.post('/orders', body: datos));

  Future<ServiceOrder> update(int id, Map<String, dynamic> datos) async =>
      _orden(await api.patch('/orders/$id', body: datos));

  Future<ServiceOrder> changeStatus(int id, String status, {String? reason, String? expectedStatus}) async =>
      _orden(await api.post('/orders/$id/status', body: {
        'status': status,
        'reason': ?reason,
        'expectedStatus': ?expectedStatus,
      }));

  Future<ServiceOrder> addService(int id, Map<String, dynamic> datos) async =>
      _orden(await api.post('/orders/$id/services', body: datos));

  Future<ServiceOrder> updateService(int id, int serviceId, Map<String, dynamic> datos) async =>
      _orden(await api.patch('/orders/$id/services/$serviceId', body: datos));

  Future<ServiceOrder> removeService(int id, int serviceId) async =>
      _orden(await api.delete('/orders/$id/services/$serviceId'));

  Future<ServiceOrder> addLabor(int id, Map<String, dynamic> datos) async =>
      _orden(await api.post('/orders/$id/labor', body: datos));

  Future<ServiceOrder> updateLabor(int id, int laborId, Map<String, dynamic> datos) async =>
      _orden(await api.patch('/orders/$id/labor/$laborId', body: datos));

  Future<ServiceOrder> removeLabor(int id, int laborId) async =>
      _orden(await api.delete('/orders/$id/labor/$laborId'));
}
