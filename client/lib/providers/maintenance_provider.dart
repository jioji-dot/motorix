import 'package:flutter/foundation.dart';

import '../models/maintenance.dart';
import '../services/api_client.dart';

/// Estado de la lista de mantenimientos programados y operaciones sobre ellos.
class MaintenanceProvider extends ChangeNotifier {
  MaintenanceProvider(this.api);

  final ApiClient api;

  List<Maintenance> items = [];
  int total = 0;
  int page = 1;
  final int pageSize = 20;
  String search = '';

  /// null = todos los pendientes; si no, una lista de clasificaciones separadas por coma (por ejemplo `VENCIDO,PROXIMO`).
  String? classificationFilter;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    total = 0;
    page = 1;
    search = '';
    classificationFilter = null;
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
      final respuesta = await api.get('/maintenance', query: {
        'search': search.trim(),
        'classification': classificationFilter,
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((m) => Maintenance.fromJson(m as Map<String, dynamic>)).toList();
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

  void setClassificationFilter(String? valor) {
    classificationFilter = valor;
    load(page: 1);
  }

  Maintenance _mantenimiento(dynamic respuesta) =>
      Maintenance.fromJson((respuesta as Map<String, dynamic>)['data'] as Map<String, dynamic>);

  Future<Maintenance> create(Map<String, dynamic> datos) async => _mantenimiento(await api.post('/maintenance', body: datos));

  Future<Maintenance> update(int id, Map<String, dynamic> datos) async =>
      _mantenimiento(await api.patch('/maintenance/$id', body: datos));
}
