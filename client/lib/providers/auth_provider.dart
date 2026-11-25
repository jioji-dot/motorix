import 'package:flutter/foundation.dart';

import '../models/terms.dart';
import '../models/user.dart';
import '../services/api_client.dart';

/// Estado de la sesión: usuario autenticado, rol y token.
class AuthProvider extends ChangeNotifier {
  AuthProvider(this.api) {
    api.onUnauthorized = _sesionVencida;
    api.onSessionInactive = logoutByInactivity;
    api.onTermsRequired = _requerirTerminos;
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

  // ---- Términos y condiciones (Sprint 7)

  TermsInfo? _terms;
  String? _termsError;
  bool _termsPending = false;

  /// Versión vigente de los términos (se carga al iniciar sesión o al recibir `TERMS_NOT_ACCEPTED`).
  TermsInfo? get terms => _terms;
  String? get termsError => _termsError;

  /// Hay una versión vigente que el usuario no ha aceptado: debe verse la pantalla de aceptación.
  bool get termsPending => _termsPending;

  /// Consulta los términos vigentes; un fallo se informa en [termsError] sin bloquear el inicio de sesión.
  Future<void> loadTerms() async {
    _termsError = null;
    notifyListeners();
    try {
      final respuesta = await api.get('/terms/current') as Map<String, dynamic>;
      final datos = respuesta['data'] as Map<String, dynamic>?;
      if (datos != null) {
        _terms = TermsInfo.fromJson(datos);
        _termsPending = !_terms!.accepted;
      }
    } on ApiException catch (e) {
      _termsError = e.message;
    } catch (_) {
      _termsError = 'No se pudieron cargar los términos. Intenta de nuevo.';
    }
    notifyListeners();
  }

  /// Acepta la versión vigente. Devuelve el mensaje de error o nulo si salió bien.
  Future<String?> acceptTerms() async {
    try {
      await api.post('/terms/accept');
    } on ApiException catch (e) {
      return e.message;
    } catch (_) {
      return 'No se pudo registrar la aceptación. Intenta de nuevo.';
    }
    _termsPending = false;
    notifyListeners();
    return null;
  }

  /// Rechazar los términos cierra la sesión.
  void rejectTerms() => _terminarSesion(null);

  void _requerirTerminos() {
    if (!isAuthenticated || _termsPending) return;
    _termsPending = true;
    loadTerms();
  }

  /// La sesión pasó demasiado tiempo sin actividad (por el temporizador de la aplicación o por la respuesta del servidor).
  void logoutByInactivity() {
    if (!isAuthenticated) return;
    _terminarSesion('Tu sesión se cerró por inactividad. Inicia sesión de nuevo.');
  }

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
      _terms = null;
      _termsPending = false;
      await _consultarTerminos();
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

  // Tras iniciar sesión se comprueba si hay una versión de los términos por aceptar (un fallo no bloquea la entrada).
  Future<void> _consultarTerminos() async {
    try {
      final respuesta = await api.get('/terms/current') as Map<String, dynamic>;
      final datos = respuesta['data'] as Map<String, dynamic>?;
      if (datos != null) {
        _terms = TermsInfo.fromJson(datos);
        _termsPending = !_terms!.accepted;
      }
    } catch (_) {
      // Sin respuesta válida no se exige nada: el servidor igual lo valida en cada petición.
    }
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
    _terms = null;
    _termsPending = false;
    _termsError = null;
    _message = mensaje;
    for (final accion in _alTerminarSesion) {
      accion();
    }
    notifyListeners();
  }
}
