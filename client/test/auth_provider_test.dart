import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/auth_provider.dart';

import 'helpers/fake_api.dart';

void main() {
  test('test_inicia_sesion_guarda_el_usuario_y_envia_el_token_en_las_siguientes_peticiones', () async {
    final FakeApi api = FakeApi((RecordedRequest r) {
      if (r.path == '/auth/login') {
        return jsonData(<String, dynamic>{
          'token': 'abc123',
          'expiresIn': 28800,
          'user': userJson(role: 'ADMIN'),
        });
      }
      return jsonData(userJson(role: 'ADMIN'));
    });
    final AuthProvider auth = AuthProvider(api: api.client);

    final bool ok = await auth.login('  recepcion ', 'Clave2026');

    expect(ok, isTrue, reason: 'el acceso debía ser exitoso');
    expect(auth.isAuthenticated, isTrue);
    expect(auth.role, UserRole.admin);
    expect(api.requests.first.body, <String, dynamic>{
      'identifier': 'recepcion',
      'password': 'Clave2026',
    });

    await api.client.get('/auth/me');
    expect(api.requests.last.headers['Authorization'], 'Bearer abc123');
  });

  test('test_un_acceso_fallido_conserva_el_mensaje_del_servidor_y_no_inicia_sesion', () async {
    final FakeApi api = FakeApi((RecordedRequest r) =>
        jsonError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.'));
    final AuthProvider auth = AuthProvider(api: api.client);

    final bool ok = await auth.login('recepcion', 'mala');

    expect(ok, isFalse);
    expect(auth.isAuthenticated, isFalse);
    expect(auth.errorMessage, 'Usuario o contraseña incorrectos.');
  });

  test('test_una_cuenta_bloqueada_muestra_el_mensaje_de_bloqueo', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonError(
          423,
          'ACCOUNT_LOCKED',
          'La cuenta está bloqueada temporalmente por demasiados intentos fallidos.',
          details: <String, dynamic>{'retryAfterSeconds': 900},
        ));
    final AuthProvider auth = AuthProvider(api: api.client);

    await auth.login('recepcion', 'mala');

    expect(auth.errorMessage, contains('bloqueada'));
  });

  test('test_cerrar_sesion_borra_el_usuario_y_el_token', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(<String, dynamic>{
          'token': 'abc123',
          'expiresIn': 28800,
          'user': userJson(),
        }));
    final AuthProvider auth = AuthProvider(api: api.client);
    await auth.login('recepcion', 'Clave2026');

    auth.logout();

    expect(auth.isAuthenticated, isFalse);
    expect(api.client.hasToken, isFalse);
  });

  test('test_una_respuesta_401_con_sesion_iniciada_marca_la_sesion_como_expirada', () async {
    bool expirada = false;
    final FakeApi api = FakeApi((RecordedRequest r) {
      if (r.path == '/auth/login') {
        return jsonData(<String, dynamic>{
          'token': 'abc123',
          'expiresIn': 28800,
          'user': userJson(),
        });
      }
      expirada = true;
      return jsonError(401, 'UNAUTHENTICATED', 'La sesión no es válida o expiró.');
    });
    final AuthProvider auth = AuthProvider(api: api.client);
    await auth.login('recepcion', 'Clave2026');

    await expectLater(api.client.get('/clients'), throwsA(anything));

    expect(expirada, isTrue);
    expect(auth.isAuthenticated, isFalse);
    expect(auth.notice, contains('sesión expiró'));
  });
}
