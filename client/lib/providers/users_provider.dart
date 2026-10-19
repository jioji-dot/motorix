import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';

/// Estado del listado de usuarios y operaciones de administración (solo ADMIN).
class UsersProvider extends ChangeNotifier {
  UsersProvider(this.api);

  final ApiClient api;

  List<User> items = [];
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
      final respuesta = await api.get('/users', query: {
        'search': search.trim(),
        'active': activeFilter?.toString(),
        'page': this.page.toString(),
        'pageSize': pageSize.toString(),
      }) as Map<String, dynamic>;
      items = (respuesta['data'] as List).map((u) => User.fromJson(u as Map<String, dynamic>)).toList();
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

  void setActiveFilter(bool? valor) {
    activeFilter = valor;
    load(page: 1);
  }

  Future<User> create(Map<String, dynamic> datos) async {
    final respuesta = await api.post('/users', body: datos) as Map<String, dynamic>;
    return User.fromJson(respuesta['data'] as Map<String, dynamic>);
  }

  Future<User> update(int id, Map<String, dynamic> datos) async {
    final respuesta = await api.patch('/users/$id', body: datos) as Map<String, dynamic>;
    return User.fromJson(respuesta['data'] as Map<String, dynamic>);
  }
}
