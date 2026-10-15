import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/models/api_error.dart';
import 'package:motorix_client/models/user.dart';
import 'package:motorix_client/providers/users_provider.dart';
import 'package:motorix_client/services/users_service.dart';

import 'helpers/fake_api.dart';

UsersProvider crearProvider(FakeApi api) => UsersProvider(UsersService(api.client));

void main() {
  test('test_carga_el_listado_de_usuarios_con_su_rol_y_estado', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => listOf(<Map<String, dynamic>>[
          userJson(id: 1, username: 'admin', role: 'ADMIN'),
          userJson(id: 2, username: 'meca', role: 'MECHANIC', active: false),
        ]));
    final UsersProvider provider = crearProvider(api);

    await provider.load();

    expect(provider.result!.items, hasLength(2));
    expect(provider.result!.items.first.role, UserRole.admin);
    expect(provider.result!.items.last.active, isFalse);
  });

  test('test_aplica_y_quita_los_filtros_de_rol_y_estado', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => emptyList());
    final UsersProvider provider = crearProvider(api);

    await provider.load(role: UserRole.mechanic, active: true, search: 'mar');
    expect(api.requests.last.query['role'], 'MECHANIC');
    expect(api.requests.last.query['active'], 'true');
    expect(api.requests.last.query['search'], 'mar');
    expect(provider.hasFilters, isTrue);

    await provider.load(clearRole: true, clearActive: true, search: '');
    expect(api.requests.last.query.containsKey('role'), isFalse);
    expect(api.requests.last.query.containsKey('active'), isFalse);
    expect(provider.hasFilters, isFalse);
  });

  test('test_el_alta_envia_el_rol_en_el_formato_de_la_api', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(userJson(), status: 201));
    final UsersProvider provider = crearProvider(api);

    await provider.create(const NewUserInput(
      username: 'nuevo',
      name: 'Nuevo Usuario',
      email: 'nuevo@motorix.local',
      role: UserRole.mechanic,
      password: 'Taller2026',
    ));

    expect(api.requests.single.method, 'POST');
    expect(api.requests.single.path, '/users');
    expect(api.requests.single.body!['role'], 'MECHANIC');
  });

  test('test_la_edicion_no_envia_el_nombre_de_usuario', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(userJson()));
    final UsersProvider provider = crearProvider(api);

    await provider.update(
      3,
      const UserChanges(name: 'Nombre', email: 'a@b.com', role: UserRole.receptionist, active: false),
    );

    expect(api.requests.single.method, 'PATCH');
    expect(api.requests.single.path, '/users/3');
    expect(api.requests.single.body!.containsKey('username'), isFalse);
    expect(api.requests.single.body!['active'], isFalse);
  });

  test('test_propaga_el_bloqueo_del_ultimo_administrador', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonError(
        409, 'LAST_ADMIN_PROTECTED', 'No se puede dejar el sistema sin un administrador activo.'));
    final UsersProvider provider = crearProvider(api);

    await expectLater(
      provider.update(
        1,
        const UserChanges(name: 'A', email: 'a@b.com', role: UserRole.admin, active: false),
      ),
      throwsA(isA<ApiError>().having((ApiError e) => e.code, 'code', 'LAST_ADMIN_PROTECTED')),
    );
  });

  test('test_restablecer_la_contrasena_llama_al_endpoint_del_usuario', () async {
    final FakeApi api = FakeApi((RecordedRequest r) => jsonData(null, status: 204));
    final UsersProvider provider = crearProvider(api);

    await provider.resetPassword(5, 'Nueva2026Clave');

    expect(api.requests.single.path, '/users/5/reset-password');
    expect(api.requests.single.body, <String, dynamic>{'newPassword': 'Nueva2026Clave'});
  });
}
