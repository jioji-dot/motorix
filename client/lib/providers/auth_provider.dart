import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';

/// Estado de la sesión. El token vive solo en memoria (se pierde al cerrar la aplicación).
class AuthProvider extends ChangeNotifier {
  AuthProvider({required ApiClient api, AuthService? service})
      : _api = api,
        _service = service ?? AuthService(api) {
    _api.onUnauthorized = _handleSessionExpired;
  }

  final ApiClient _api;
  final AuthService _service;

  AppUser? _user;
  bool _isLoading = false;
  String? _errorMessage;
  String? _notice;

  AppUser? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  UserRole? get role => _user?.role;

  /// Último error de inicio de sesión, para mostrarlo en la pantalla de acceso.
  String? get errorMessage => _errorMessage;

  /// Aviso informativo (por ejemplo, sesión expirada) para la pantalla de acceso.
  String? get notice => _notice;

  Future<bool> login(String identifier, String password) async {
    _isLoading = true;
    _errorMessage = null;
    _notice = null;
    notifyListeners();
    try {
      final LoginResult resultado = await _service.login(identifier.trim(), password);
      _api.setToken(resultado.token);
      _user = resultado.user;
      return true;
    } on ApiError catch (error) {
      _errorMessage = error.message;
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void logout() {
    _api.setToken(null);
    _user = null;
    _errorMessage = null;
    _notice = null;
    notifyListeners();
  }

  /// Cambia la contraseña del usuario actual; lanza [ApiError] si el servidor la rechaza.
  Future<void> changePassword(String currentPassword, String newPassword) =>
      _service.changePassword(currentPassword, newPassword);

  void _handleSessionExpired() {
    if (_user == null) return;
    _api.setToken(null);
    _user = null;
    _notice = 'Tu sesión expiró. Inicia sesión de nuevo.';
    notifyListeners();
  }
}
