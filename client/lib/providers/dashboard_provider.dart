import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/dashboard.dart';
import '../services/dashboard_service.dart';

/// Estado del panel de control: carga, error y actualización bajo demanda.
class DashboardProvider extends ChangeNotifier {
  DashboardProvider(this._service);

  final DashboardService _service;

  Dashboard? _data;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  Dashboard? get data => _data;
  bool get loading => _loading;
  String? get error => _error;

  /// Carga o actualiza los indicadores. Si falla al actualizar conserva los últimos datos y el error.
  Future<void> load() async {
    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final Dashboard datos = await _service.fetch();
      if (solicitud != _requestId) return;
      _data = datos;
    } on ApiError catch (error) {
      if (solicitud != _requestId) return;
      _error = error.message;
    } catch (_) {
      if (solicitud != _requestId) return;
      _error = 'El servidor respondió con un formato inesperado.';
    } finally {
      if (solicitud == _requestId) {
        _loading = false;
        notifyListeners();
      }
    }
  }
}
