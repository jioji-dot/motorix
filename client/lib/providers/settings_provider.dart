import 'package:flutter/foundation.dart';

import '../models/app_settings.dart';
import '../services/api_client.dart';
import '../utils/error_text.dart';

/// Configuración del taller y márgenes de «Próximo» (solo administrador). Las cifras se piden al servidor al abrir la pantalla.
class SettingsProvider extends ChangeNotifier {
  SettingsProvider(this.api);

  final ApiClient api;

  AppSettings? data;
  bool loading = false;
  String? error;

  void reset() {
    data = null;
    loading = false;
    error = null;
    notifyListeners();
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final respuesta = await api.get('/settings') as Map<String, dynamic>;
      data = AppSettings.fromJson(respuesta['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      error = e.message;
      data = null;
    } catch (_) {
      error = 'No se pudo leer la respuesta del servidor. Intenta de nuevo.';
      data = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Guarda los datos indicados. Devuelve el mensaje de error o nulo si salió bien.
  Future<String?> save({
    Map<String, dynamic>? workshop,
    Map<String, dynamic>? maintenance,
  }) async {
    try {
      final respuesta = await api.put(
        '/settings',
        body: {
          'workshop': ?workshop,
          'maintenance': ?maintenance,
        },
      ) as Map<String, dynamic>;
      data = AppSettings.fromJson(respuesta['data'] as Map<String, dynamic>);
      notifyListeners();
      return null;
    } catch (e) {
      return errorText(e);
    }
  }
}
