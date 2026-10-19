import 'package:flutter/foundation.dart';

import '../models/dashboard.dart';
import '../services/api_client.dart';

/// Estado del panel de control del administrador. Las cifras se piden al servidor cada vez que se abre.
class DashboardProvider extends ChangeNotifier {
  DashboardProvider(this.api);

  final ApiClient api;

  Dashboard? data;
  bool loading = false;
  String? error;

  /// Vacía el estado al terminar la sesión.
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
      final respuesta = await api.get('/dashboard') as Map<String, dynamic>;
      data = Dashboard.fromJson(respuesta['data'] as Map<String, dynamic>);
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
}
