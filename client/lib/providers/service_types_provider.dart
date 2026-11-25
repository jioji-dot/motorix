import 'package:flutter/foundation.dart';

import '../models/service_type.dart';
import '../services/api_client.dart';
import '../utils/error_text.dart';

/// Catálogo de tipos de servicio (Sprint 7). El administrador ve todos; los demás roles reciben solo los activos.
class ServiceTypesProvider extends ChangeNotifier {
  ServiceTypesProvider(this.api);

  final ApiClient api;

  List<ServiceType> items = [];
  bool loading = false;
  bool loaded = false;
  String? error;

  List<ServiceType> get activeTypes => items.where((t) => t.active).toList();

  void reset() {
    items = [];
    loading = false;
    loaded = false;
    error = null;
    notifyListeners();
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final respuesta = await api.get('/service-types') as Map<String, dynamic>;
      items = (respuesta['data'] as List<dynamic>)
          .map((e) => ServiceType.fromJson(e as Map<String, dynamic>))
          .toList();
      loaded = true;
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

  /// Crea un tipo. Devuelve el mensaje de error o nulo si salió bien.
  Future<String?> create({required String name, int? days, int? km}) async {
    try {
      await api.post(
        '/service-types',
        body: {'name': name, 'intervalDays': days, 'intervalKm': km},
      );
    } catch (e) {
      return errorText(e);
    }
    await load();
    return null;
  }

  Future<String?> update(int id, Map<String, dynamic> cambios) async {
    try {
      await api.patch('/service-types/$id', body: cambios);
    } catch (e) {
      return errorText(e);
    }
    await load();
    return null;
  }
}
