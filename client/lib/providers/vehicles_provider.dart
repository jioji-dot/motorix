import 'package:flutter/foundation.dart';

import '../models/vehicle.dart';
import '../services/api_client.dart';

/// Estado del listado de vehículos y operaciones sobre ellos.
class VehiclesProvider extends ChangeNotifier {
  VehiclesProvider(this.api);

  final ApiClient api;

  List<Vehicle> items = [];
  int total = 0;
  int page = 1;
  final int pageSize = 20;
  String search = '';
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    total = 0;
    page = 1;
    search = '';
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
      final respuesta = await api.get('/vehicles', query: {
        'search': search.trim(),
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((v) => Vehicle.fromJson(v as Map<String, dynamic>)).toList();
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

  Future<Vehicle> fetchDetail(int id) async {
    final respuesta = await api.get('/vehicles/$id') as Map<String, dynamic>;
    return Vehicle.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Vehicle> create(Map<String, dynamic> datos) async {
    final respuesta = await api.post('/vehicles', body: datos) as Map<String, dynamic>;
    return Vehicle.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Vehicle> update(int id, Map<String, dynamic> datos) async {
    final respuesta = await api.patch('/vehicles/$id', body: datos) as Map<String, dynamic>;
    return Vehicle.fromJson(respuesta['data'] as Map<String, dynamic>);
  }
}
