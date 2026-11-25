import 'package:flutter/foundation.dart';

import '../models/client_notice.dart';
import '../services/api_client.dart';

/// Lista de clientes por avisar (Sprint 6). Marcar como avisado solo deja constancia: la aplicación no envía mensajes.
class ClientNoticesProvider extends ChangeNotifier {
  ClientNoticesProvider(this.api);

  final ApiClient api;

  static const pageSize = 50;

  List<PendingClientNotice> items = [];
  int page = 1;
  int total = 0;
  bool loading = false;
  String? error;

  int get totalPages => total == 0 ? 1 : (total / pageSize).ceil();

  /// Vacía el estado al terminar la sesión.
  void reset() {
    items = [];
    page = 1;
    total = 0;
    loading = false;
    error = null;
    notifyListeners();
  }

  Future<void> load({int? page}) async {
    this.page = page ?? this.page;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final respuesta = await api.get('/client-notices', query: {'page': '${this.page}', 'pageSize': '$pageSize'}) as Map<String, dynamic>;
      items = (respuesta['data'] as List<dynamic>).map((e) => PendingClientNotice.fromJson(e as Map<String, dynamic>)).toList();
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

  /// Registra que se avisó al cliente. Devuelve el mensaje de error o nulo si salió bien; si el hecho ya no aplica,
  /// el servidor responde con un mensaje y la lista se actualiza.
  Future<String?> markNoticed(PendingClientNotice hecho, {String? note}) async {
    String? mensaje;
    try {
      await api.post('/client-notices', body: {
        'kind': hecho.kind,
        'factId': hecho.factId,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      });
    } on ApiException catch (e) {
      mensaje = e.message;
    } catch (_) {
      mensaje = 'No se pudo registrar el aviso. Intenta de nuevo.';
    }
    await load();
    return mensaje;
  }
}
