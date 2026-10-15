import 'package:flutter/foundation.dart';

import '../models/api_error.dart';
import '../models/paged_result.dart';
import '../models/user.dart';
import '../services/users_service.dart';

/// Estado de la gestión de usuarios: listado con filtros y paginación, alta, edición y
/// restablecimiento de contraseña.
class UsersProvider extends ChangeNotifier {
  UsersProvider(this._service);

  final UsersService _service;

  PagedResult<AppUser>? _result;
  String _search = '';
  UserRole? _role;
  bool? _active;
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  PagedResult<AppUser>? get result => _result;
  String get search => _search;
  UserRole? get roleFilter => _role;
  bool? get activeFilter => _active;
  bool get loading => _loading;
  String? get error => _error;

  bool get hasFilters => _search.isNotEmpty || _role != null || _active != null;

  /// Carga una página aplicando los filtros. Los filtros que se pasan reemplazan a los anteriores;
  /// use [clearRole] / [clearActive] para quitarlos.
  Future<void> load({
    int page = 1,
    String? search,
    UserRole? role,
    bool clearRole = false,
    bool? active,
    bool clearActive = false,
  }) async {
    if (search != null) _search = search.trim();
    if (clearRole) _role = null;
    if (role != null) _role = role;
    if (clearActive) _active = null;
    if (active != null) _active = active;

    final int solicitud = ++_requestId;
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final PagedResult<AppUser> pagina = await _service.list(
        search: _search,
        role: _role,
        active: _active,
        page: page,
      );
      if (solicitud != _requestId) return;
      _result = pagina;
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

  /// Registra un usuario. Lanza [ApiError] (usuario o correo repetidos, política de contraseña).
  Future<AppUser> create(NewUserInput input) => _service.create(input);

  /// Edita un usuario. Lanza [ApiError] (por ejemplo `LAST_ADMIN_PROTECTED`).
  Future<AppUser> update(int id, UserChanges changes) => _service.update(id, changes);

  /// Restablece la contraseña de otro usuario. Lanza [ApiError] si no cumple la política.
  Future<void> resetPassword(int id, String newPassword) =>
      _service.resetPassword(id, newPassword);
}
