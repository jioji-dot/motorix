import 'package:flutter/foundation.dart';

import '../models/client.dart';
import '../services/api_client.dart';

/// Estado del listado de clientes y operaciones sobre ellos.
class ClientsProvider extends ChangeNotifier {
  ClientsProvider(this.api);

  final ApiClient api;

  List<Client> items = [];
  int total = 0;
  int page = 1;
  final int pageSize = 20;
  String search = '';

  /// null = todos, true = solo activos, false = solo inactivos.
  bool? activeFilter;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    total = 0;
    page = 1;
    search = '';
    activeFilter = null;
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
      final respuesta = await api.get('/clients', query: {
        'search': search.trim(),
        'active': activeFilter?.toString(),
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((c) => Client.fromJson(c as Map<String, dynamic>)).toList();
      total = (respuesta['meta'] as Map<String, dynamic>)['total'] as int;
    } on ApiException catch (e) {
      error = e.message;
      items = [];
    } catch (_) {
      // Respuesta con un formato inesperado: se informa sin detalles internos.
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

  void setActiveFilter(bool? valor) {
    activeFilter = valor;
    load(page: 1);
  }

  /// Busca clientes para el selector de propietario, sin modificar el listado en pantalla.
  Future<List<Client>> searchClients(String texto) async {
    final respuesta = await api.get('/clients', query: {
      'search': texto.trim(),
      'active': 'true',
      'pageSize': '20',
    }) as Map<String, dynamic>;
    return (respuesta['data'] as List).map((c) => Client.fromJson(c as Map<String, dynamic>)).toList();
  }

  Future<Client> fetchDetail(int id) async {
    final respuesta = await api.get('/clients/$id') as Map<String, dynamic>;
    return Client.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Client> create(Map<String, dynamic> datos) async {
    final respuesta = await api.post('/clients', body: datos) as Map<String, dynamic>;
    return Client.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<Client> update(int id, Map<String, dynamic> datos) async {
    final respuesta = await api.patch('/clients/$id', body: datos) as Map<String, dynamic>;
    return Client.fromJson(respuesta['data'] as Map<String, dynamic>);
  }
}
