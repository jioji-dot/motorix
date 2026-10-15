import '../models/user.dart';
import 'api_client.dart';

/// Resultado de un inicio de sesión exitoso.
class LoginResult {
  const LoginResult({required this.token, required this.user});

  final String token;
  final AppUser user;
}

/// Llamadas de autenticación a la API.
class AuthService {
  AuthService(this._api);

  final ApiClient _api;

  Future<LoginResult> login(String identifier, String password) async {
    final ApiResponse r = await _api.post(
      '/auth/login',
      body: <String, String>{'identifier': identifier, 'password': password},
    );
    final Map<String, dynamic> data = r.data as Map<String, dynamic>;
    return LoginResult(
      token: data['token'] as String,
      user: AppUser.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  Future<AppUser> me() async {
    final ApiResponse r = await _api.get('/auth/me');
    return AppUser.fromJson(r.data as Map<String, dynamic>);
  }

  Future<void> changePassword(String currentPassword, String newPassword) async {
    await _api.post(
      '/auth/change-password',
      body: <String, String>{'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }
}
