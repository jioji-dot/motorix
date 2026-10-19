import 'package:flutter/foundation.dart';

import '../models/part.dart';
import '../services/api_client.dart';

/// Estado del inventario de refacciones: listado con filtros, alertas y operaciones del administrador.
class PartsProvider extends ChangeNotifier {
  PartsProvider(this.api);

  final ApiClient api;

  List<Part> items = [];
  StockSummary? summary;
  List<String> categories = [];
  int total = 0;
  int page = 1;
  final int pageSize = 20;
  String search = '';
  String? categoryFilter;

  /// Filtro de alertas: `LOW,OUT` muestra solo las refacciones con stock bajo o agotadas.
  bool onlyAlerts = false;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    summary = null;
    categories = [];
    total = 0;
    page = 1;
    search = '';
    categoryFilter = null;
    onlyAlerts = false;
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
      final respuesta = await api.get('/parts', query: {
        'search': search.trim(),
        'category': categoryFilter,
        'stockLevel': onlyAlerts ? 'LOW,OUT' : null,
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((p) => Part.fromJson(p as Map<String, dynamic>)).toList();
      total = (respuesta['meta'] as Map<String, dynamic>)['total'] as int;
      await _loadAuxiliary();
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

  // El resumen de alertas y las categorías se leen junto con el listado; si fallan, el listado sigue siendo útil.
  Future<void> _loadAuxiliary() async {
    try {
      final resumen = await api.get('/parts/summary') as Map<String, dynamic>;
      summary = StockSummary.fromJson(resumen['data'] as Map<String, dynamic>);
      final cats = await api.get('/parts/categories') as Map<String, dynamic>;
      categories = (cats['data'] as List).cast<String>();
    } catch (_) {
      // Se conservan los últimos valores conocidos.
    }
  }

  void setSearch(String valor) {
    search = valor;
    load(page: 1);
  }

  void setCategory(String? valor) {
    categoryFilter = valor;
    load(page: 1);
  }

  void setOnlyAlerts(bool valor) {
    onlyAlerts = valor;
    load(page: 1);
  }

  /// Búsqueda de refacciones activas para agregarlas a una orden, sin modificar el listado en pantalla.
  Future<List<Part>> searchForOrder(String texto) async {
    final respuesta = await api.get('/parts', query: {
      'search': texto.trim(),
      'active': 'true',
      'pageSize': '30',
    }) as Map<String, dynamic>;
    return (respuesta['data'] as List).map((p) => Part.fromJson(p as Map<String, dynamic>)).toList();
  }

  Future<PartDetail> fetchDetail(int id) async {
    final respuesta = await api.get('/parts/$id') as Map<String, dynamic>;
    return PartDetail.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Part> create(Map<String, dynamic> datos) async {
    final respuesta = await api.post('/parts', body: datos) as Map<String, dynamic>;
    return Part.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Part> update(int id, Map<String, dynamic> datos) async {
    final respuesta = await api.patch('/parts/$id', body: datos) as Map<String, dynamic>;
    return Part.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  /// Registra una entrada, una salida o un ajuste. Devuelve la refacción con su stock actualizado.
  Future<Part> registerMovement(int id, {required String type, required int quantity, required String reason}) async {
    final respuesta = await api.post('/parts/$id/movements', body: {
      'type': type,
      'quantity': quantity,
      'reason': reason,
    }) as Map<String, dynamic>;
    return Part.fromJson((respuesta['data'] as Map<String, dynamic>)['part'] as Map<String, dynamic>);
  }
}
