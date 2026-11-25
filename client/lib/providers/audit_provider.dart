import 'package:flutter/foundation.dart';

import '../models/audit_entry.dart';
import '../services/api_client.dart';

/// Bitácora de acciones sensibles: solo lectura, paginada y con filtro por acción (Sprint 7).
class AuditProvider extends ChangeNotifier {
  AuditProvider(this.api);

  final ApiClient api;

  static const pageSize = 50;

  List<AuditEntry> items = [];
  int page = 1;
  int total = 0;
  String? action;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  void reset() {
    items = [];
    page = 1;
    total = 0;
    action = null;
    loading = false;
    error = null;
    notifyListeners();
  }

  void setAction(String? valor) {
    action = valor;
    load(page: 1);
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
