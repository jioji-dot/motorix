import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/api_client.dart';

/// Estado de la sesión: usuario autenticado, rol y token.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this.api) {
    api.onUnauthorized = _sesionVencida;
  }

  final ApiClient api;

  User? _user;
  bool _loading = false;
  String? _message;

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get loading => _loading;

  /// Mensaje informativo (por ejemplo, sesión vencida) para mostrar en el inicio de sesión.
  String? get message => _message;

  UserRole? get role => _user?.role;

  /// Permisos de escritura sobre clientes y vehículos (también se validan en el backend).
  bool get canManageRecords => _user?.canManageRecords ?? false;

  /// Inicia sesión con usuario o correo en el mismo campo.
  Future<void> login(String identifier, String password) async {
    _loading = true;
    _message = null;
    notifyListeners();
    try {
      final respuesta = await api.post('/auth/login', body: {
        'identifier': identifier.trim(),
        'password': password,
      }) as Map<String, dynamic>;
      final datos = respuesta['data'] as Map<String, dynamic>;
      api.token = datos['token'] as String;
      _user = User.fromJson(datos['user'] as Map<String, dynamic>);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Cambia la contraseña del usuario actual.
  Future<void> changePassword(String currentPassword, String newPassword) async {
    await api.post('/auth/change-password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  void logout() {
    _terminarSesion(null);
  }

  void _sesionVencida() {
    _terminarSesion('Tu sesión expiró. Inicia sesión de nuevo.');
  }

  /// Los providers de datos se registran aquí para vaciar su estado cuando termina la sesión.
  final List<VoidCallback> _alTerminarSesion = [];

  void addSessionEndListener(VoidCallback accion) => _alTerminarSesion.add(accion);

  void _terminarSesion(String? mensaje) {
    api.token = null;
    _user = null;
    _message = mensaje;
    for (final accion in _alTerminarSesion) {
      accion();
    }
    notifyListeners();
  }
}
