import 'package:flutter/foundation.dart';

import '../models/audit_entry.dart';
import '../services/api_client.dart';

/// Bitácora de acciones sensibles: solo lectura, paginada y con filtros por fecha, usuario y acción (Sprint 7, FR-025).
class AuditProvider extends ChangeNotifier {
  AuditProvider(this.api);

  final ApiClient api;

  static const pageSize = 50;

  List<AuditEntry> items = [];
  int page = 1;
  int total = 0;
  String? action;
  String? from;
  String? to;
  int? userId;

  /// Usuarios para el filtro (id y nombre), leídos una vez de `/users`.
  List<({int id, String name})> users = [];
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  void reset() {
    items = [];
    page = 1;
    total = 0;
    action = null;
    from = null;
    to = null;
    userId = null;
    users = [];
    loading = false;
    error = null;
    notifyListeners();
  }

  void setAction(String? valor) {
    action = valor;
    load(page: 1);
  }

  /// Aplica el rango de fechas (AAAA-MM-DD; vacío = sin límite) y el usuario, y vuelve a la primera página.
  void setFilters({String? from, String? to, int? userId}) {
    this.from = (from == null || from.trim().isEmpty) ? null : from.trim();
    this.to = (to == null || to.trim().isEmpty) ? null : to.trim();
    this.userId = userId;
    load(page: 1);
  }

  /// Lee la lista de usuarios para el filtro; si falla, el filtro queda solo con «Todos los usuarios».
  Future<void> loadUsers() async {
    try {
      final respuesta = await api.get(
        '/users',
        query: {'page': '1', 'pageSize': '100'},
      ) as Map<String, dynamic>;
      users = [
        for (final u in respuesta['data'] as List<dynamic>)
          (
            id: (u as Map<String, dynamic>)['id'] as int,
            name: u['name'] as String,
          ),
      ];
      notifyListeners();
    } catch (_) {
      users = [];
    }
  }

  Future<void> load({int? page}) async {
    this.page = page ?? this.page;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final respuesta = await api.get(
        '/audit-log',
        query: {
          'action': action,
          'from': from,
          'to': to,
          'userId': userId?.toString(),
          'page': '${this.page}',
          'pageSize': '$pageSize',
        },
      ) as Map<String, dynamic>;
      items = (respuesta['data'] as List<dynamic>)
          .map((e) => AuditEntry.fromJson(e as Map<String, dynamic>))
          .toList();
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
}
