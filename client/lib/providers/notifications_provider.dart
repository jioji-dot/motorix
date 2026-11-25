import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/notification.dart';
import '../services/api_client.dart';

/// Avisos internos del usuario (Sprint 6). Se piden al iniciar sesión, al cambiar de sección y cada 60 segundos.
/// Un fallo de la consulta periódica no molesta al usuario: se conserva el último resultado.
class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider(this.api, {this.pollInterval = const Duration(seconds: 60)});

  final ApiClient api;

  /// Cada cuánto se actualiza el contador (FR-011); se puede cambiar en las pruebas.
  final Duration pollInterval;

  NotificationsData? data;
  bool loading = false;
  String? error;

  Timer? _timer;
  bool _disposed = false;

  int get unread => data?.unread ?? 0;
  int get stockAlerts => data?.stockAlerts ?? 0;
  int get clientsToNotify => data?.clientsToNotify ?? 0;

  /// Empieza a actualizar cada [pollInterval] y consulta de inmediato.
  void start() {
    _timer?.cancel();
    _timer = Timer.periodic(pollInterval, (_) => refresh(silent: true));
    refresh(silent: data != null);
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  /// Vacía el estado y detiene el sondeo al terminar la sesión.
  void reset() {
    stop();
    data = null;
    loading = false;
    error = null;
    _notify();
  }

  /// Consulta los avisos. Con [silent] no muestra el estado de carga y, si falla, conserva el último resultado.
  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      loading = true;
      error = null;
      _notify();
    }
    try {
      final respuesta = await api.get('/notifications') as Map<String, dynamic>;
      data = NotificationsData.fromJson(respuesta['data'] as Map<String, dynamic>);
      error = null;
    } on ApiException catch (e) {
      if (data == null || !silent) error = e.message;
    } catch (_) {
      if (data == null || !silent) error = 'No se pudo leer la respuesta del servidor. Intenta de nuevo.';
    } finally {
      loading = false;
      _notify();
    }
  }

  /// Marca un aviso como leído y actualiza el contador. Devuelve el mensaje de error o nulo si salió bien.
  Future<String?> markRead(String key) async {
    try {
      await api.post('/notifications/read', body: {'key': key});
    } on ApiException catch (e) {
      return e.message;
    } catch (_) {
      return 'No se pudo marcar el aviso como leído. Intenta de nuevo.';
    }
    await refresh(silent: true);
    return null;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
