// Pruebas de integración del acceso (US1) contra la base `motorix_test`.
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { TEST_PASSWORD, createAuthenticated, createUser } from '../helpers/factories.js';

const app = createApp();

const login = (identifier, password = TEST_PASSWORD) =>
  request(app).post('/api/auth/login').send({ identifier, password });

beforeEach(cleanTables);
afterAll(closePool);

describe('inicio de sesión', () => {
  test('test_inicia_sesion_con_el_nombre_de_usuario', async () => {
    await createUser({ username: 'recepcion', role: 'RECEPTIONIST' });

    const res = await login('recepcion');

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('RECEPTIONIST');
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  test('test_inicia_sesion_con_el_correo_en_el_mismo_campo', async () => {
    await createUser({ username: 'recepcion', email: 'recepcion@motorix.local' });

    const res = await login('recepcion@motorix.local');

    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('recepcion');
  });

  test('test_ignora_mayusculas_y_espacios_sobrantes_en_usuario_y_correo', async () => {
    await createUser({ username: 'recepcion', email: 'recepcion@motorix.local' });

    expect((await login('  RECEPCION  ')).status).toBe(200);
    expect((await login('  Recepcion@Motorix.LOCAL ')).status).toBe(200);
  });

  test('test_inicia_sesion_con_cada_uno_de_los_tres_roles', async () => {
    for (const role of ['ADMIN', 'RECEPTIONIST', 'MECHANIC']) {
      const usuario = await createUser({ role });
      const res = await login(usuario.username);
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(role);
    }
  });

  test('test_contrasena_incorrecta_y_usuario_inexistente_dan_el_mismo_mensaje', async () => {
    await createUser({ username: 'recepcion' });

    const mala = await login('recepcion', 'Incorrecta1');
    const inexistente = await login('nadie', 'Incorrecta1');

    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body).toEqual(inexistente.body);
    expect(mala.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('test_una_cuenta_inactiva_no_puede_iniciar_sesion', async () => {
    await createUser({ username: 'inactivo', active: false });

    const res = await login('inactivo');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('test_guarda_la_contrasena_cifrada_con_bcrypt', async () => {
    await createUser({ username: 'recepcion' });

    const [[fila]] = await pool.query(
      "SELECT password_hash FROM users WHERE username = 'recepcion'"
    );

    expect(fila.password_hash).not.toContain(TEST_PASSWORD);
    expect(fila.password_hash).toMatch(/^\$2[aby]\$/);
  });
});

describe('bloqueo por intentos fallidos', () => {
  test('test_bloquea_la_cuenta_en_el_quinto_intento_fallido_consecutivo', async () => {
    await createUser({ username: 'bloqueable' });

    for (let i = 1; i <= 4; i += 1) {
      const res = await login('bloqueable', 'Incorrecta1');
      expect(res.status).toBe(401);
    }
    const quinto = await login('bloqueable', 'Incorrecta1');

    expect(quinto.status).toBe(423);
    expect(quinto.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  test('test_una_cuenta_bloqueada_rechaza_incluso_la_contrasena_correcta', async () => {
    await createUser({ username: 'bloqueable' });
    for (let i = 0; i < 5; i += 1) await login('bloqueable', 'Incorrecta1');

    const res = await login('bloqueable', TEST_PASSWORD);

    expect(res.status).toBe(423);
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  test('test_reinicia_el_contador_tras_un_acceso_correcto', async () => {
    await createUser({ username: 'recuperable' });

    for (let i = 0; i < 3; i += 1) await login('recuperable', 'Incorrecta1');
    expect((await login('recuperable')).status).toBe(200);
    for (let i = 0; i < 4; i += 1) {
      expect((await login('recuperable', 'Incorrecta1')).status).toBe(401);
    }
  });

  test('test_permite_acceder_cuando_el_bloqueo_ya_vencio', async () => {
    await createUser({ username: 'vencido' });
    for (let i = 0; i < 5; i += 1) await login('vencido', 'Incorrecta1');
    await pool.query(
      "UPDATE users SET locked_until = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE username = 'vencido'"
    );

    const res = await login('vencido');

    expect(res.status).toBe(200);
    const [[fila]] = await pool.query(
      "SELECT failed_login_attempts, locked_until FROM users WHERE username = 'vencido'"
    );
    expect(fila.failed_login_attempts).toBe(0);
    expect(fila.locked_until).toBeNull();
  });

  test('test_los_intentos_contra_usuarios_inexistentes_no_bloquean_nada', async () => {
    for (let i = 0; i < 6; i += 1) {
      const res = await login('fantasma', 'Incorrecta1');
      expect(res.status).toBe(401);
    }
  });
});

describe('sesión y token', () => {
  test('test_rechaza_peticiones_sin_token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('test_rechaza_un_token_invalido', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('test_rechaza_un_token_expirado', async () => {
    const { user } = await createAuthenticated('ADMIN');
    const expirado = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, {
      expiresIn: -10
    });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expirado}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('test_un_usuario_desactivado_pierde_el_acceso_aunque_su_token_siga_vigente', async () => {
    const { user, auth } = await createAuthenticated('RECEPTIONIST');
    expect((await request(app).get('/api/auth/me').set('Authorization', auth)).status).toBe(200);

    await pool.query('UPDATE users SET active = 0 WHERE id = ?', [user.id]);

    const res = await request(app).get('/api/auth/me').set('Authorization', auth);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('test_un_cambio_de_rol_aplica_de_inmediato_al_perfil', async () => {
    const { user, auth } = await createAuthenticated('RECEPTIONIST');
    await pool.query("UPDATE users SET role = 'MECHANIC' WHERE id = ?", [user.id]);

    const res = await request(app).get('/api/auth/me').set('Authorization', auth);

    expect(res.body.data.role).toBe('MECHANIC');
  });
});

describe('cambio de contraseña', () => {
  const cambiar = (auth, cuerpo) =>
    request(app).post('/api/auth/change-password').set('Authorization', auth).send(cuerpo);

  test('test_cambia_la_contrasena_y_permite_entrar_solo_con_la_nueva', async () => {
    const { user, auth } = await createAuthenticated('RECEPTIONIST');

    const res = await cambiar(auth, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'NuevaClave2026'
    });

    expect(res.status).toBe(204);
    expect((await login(user.username, 'NuevaClave2026')).status).toBe(200);
    expect((await login(user.username, TEST_PASSWORD)).status).toBe(401);
  });

  test('test_rechaza_la_contrasena_actual_incorrecta', async () => {
    const { auth } = await createAuthenticated();

    const res = await cambiar(auth, { currentPassword: 'Equivocada1', newPassword: 'NuevaClave2026' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test.each([
    ['corta', 'Ab1cdef'],
    ['sin mayúscula', 'nuevaclave2026'],
    ['sin minúscula', 'NUEVACLAVE2026'],
    ['sin número', 'NuevaClaveTaller']
  ])('test_rechaza_una_contrasena_nueva_%s', async (_nombre, nueva) => {
    const { auth } = await createAuthenticated();

    const res = await cambiar(auth, { currentPassword: TEST_PASSWORD, newPassword: nueva });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('test_rechaza_una_contrasena_nueva_igual_a_la_actual', async () => {
    const { auth } = await createAuthenticated();

    const res = await cambiar(auth, { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('test_exige_sesion_para_cambiar_la_contrasena', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NuevaClave2026' });

    expect(res.status).toBe(401);
  });
});
