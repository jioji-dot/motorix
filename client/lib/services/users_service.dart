import '../models/paged_result.dart';
import '../models/user.dart';
import 'api_client.dart';

/// Datos para registrar un usuario.
class NewUserInput {
  const NewUserInput({
    required this.username,
    required this.name,
    required this.email,
    required this.role,
    required this.password,
  });

  final String username;
  final String name;
  final String email;
  final UserRole role;
  final String password;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'username': username,
        'name': name,
        'email': email,
        'role': role.apiValue,
        'password': password,
      };
}

/// Datos editables de un usuario existente (el nombre de usuario no cambia).
class UserChanges {
  const UserChanges({
    required this.name,
    required this.email,
    required this.role,
    required this.active,
  });

  final String name;
  final String email;
  final UserRole role;
  final bool active;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'email': email,
        'role': role.apiValue,
        'active': active,
      };
}

/// Llamadas a `/api/users` (solo administrador).
class UsersService {
  UsersService(this._api);

  final ApiClient _api;

  Future<PagedResult<AppUser>> list({
    String? search,
    UserRole? role,
    bool? active,
    int page = 1,
    int pageSize = 20,
  }) async {
    final ApiResponse r = await _api.get(
      '/users',
      query: <String, dynamic>{
        'search': search,
        'role': role?.apiValue,
        'active': active,
        'page': page,
        'pageSize': pageSize,
      },
    );
    final Map<String, dynamic> meta = r.meta ?? <String, dynamic>{};
    return PagedResult<AppUser>(
      items: (r.data as List<dynamic>)
          .map((dynamic u) => AppUser.fromJson(u as Map<String, dynamic>))
          .toList(),
      total: (meta['total'] as int?) ?? 0,
      page: (meta['page'] as int?) ?? page,
      pageSize: (meta['pageSize'] as int?) ?? pageSize,
    );
  }

  Future<AppUser> create(NewUserInput input) async {
    final ApiResponse r = await _api.post('/users', body: input.toJson());
    return AppUser.fromJson(r.data as Map<String, dynamic>);
  }

  Future<AppUser> update(int id, UserChanges changes) async {
    final ApiResponse r = await _api.patch('/users/$id', body: changes.toJson());
    return AppUser.fromJson(r.data as Map<String, dynamic>);
  }

  Future<void> resetPassword(int id, String newPassword) async {
    await _api.post('/users/$id/reset-password', body: <String, String>{'newPassword': newPassword});
  }
}
