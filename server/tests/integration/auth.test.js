import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { CONTRASENA_PRUEBA, cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

const login = (identifier, password = CONTRASENA_PRUEBA) =>
  request(app).post('/api/auth/login').send({ identifier, password });

describe('Inicio de sesión (integración)', () => {
  test.each([
    ['admin', 'ADMIN'],
    ['recepcion', 'RECEPTIONIST'],
    ['mecanico', 'MECHANIC'],
  ])('permite_entrar_con_el_usuario_%s_y_devuelve_el_rol_%s', async (username, rol) => {
    const respuesta = await login(username);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.user.role).toBe(rol);
    expect(respuesta.body.data.token).toEqual(expect.any(String));
  });

  test.each([
    ['admin@motorix.test', 'ADMIN'],
    ['recepcion@motorix.test', 'RECEPTIONIST'],
    ['mecanico@motorix.test', 'MECHANIC'],
  ])('permite_entrar_con_el_correo_%s_en_el_mismo_campo', async (correo, rol) => {
    const respuesta = await login(correo);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.user.role).toBe(rol);
  });

  test('el_token_emitido_sirve_para_consultar_el_perfil', async () => {
    const entrada = await login('recepcion');
    const perfil = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${entrada.body.data.token}`);
    expect(perfil.status).toBe(200);
    expect(perfil.body.data.username).toBe('recepcion');
  });

  test('rechaza_credenciales_incorrectas_con_mensaje_generico', async () => {
    const respuesta = await login('recepcion', 'Incorrecta2026');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('rechaza_campos_vacios_con_error_de_validacion', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({ identifier: '', password: '' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rechaza_peticiones_sin_token_o_con_token_invalido', async () => {
    const sinToken = await request(app).get('/api/auth/me');
    expect(sinToken.status).toBe(401);
    const falso = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(falso.status).toBe(401);
  });

  test('una_cuenta_desactivada_deja_de_entrar_de_inmediato_aunque_tenga_token', async () => {
    const entrada = await login('mecanico');
    await pool.execute('UPDATE users SET active = 0 WHERE id = ?', [usuarios.MECHANIC.id]);
    const perfil = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${entrada.body.data.token}`);
    expect(perfil.status).toBe(403);
    expect(perfil.body.error.code).toBe('ACCOUNT_DISABLED');
    const nuevoLogin = await login('mecanico');
    expect(nuevoLogin.status).toBe(403);
    await pool.execute('UPDATE users SET active = 1 WHERE id = ?', [usuarios.MECHANIC.id]);
  });

  test('bloquea_la_cuenta_tras_5_intentos_fallidos_y_responde_423', async () => {
    for (let intento = 1; intento <= 5; intento += 1) {
      const fallido = await login('admin', 'Incorrecta2026');
      expect(fallido.status).toBe(401);
    }
    const bloqueada = await login('admin');
    expect(bloqueada.status).toBe(423);
    expect(bloqueada.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(bloqueada.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(bloqueada.body.error.retryAfterSeconds).toBeLessThanOrEqual(900);

    // Al vencer el bloqueo vuelve a poder entrar.
    await pool.execute('UPDATE users SET lockedUntil = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?', [
      usuarios.ADMIN.id,
    ]);
    const desbloqueada = await login('admin');
    expect(desbloqueada.status).toBe(200);
  });
});

describe('Cambio de contraseña (integración)', () => {
  test('cambia_la_contrasena_cumpliendo_la_politica_y_la_anterior_deja_de_funcionar', async () => {
    const entrada = await login('recepcion');
    const cambio = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${entrada.body.data.token}`)
      .send({ currentPassword: CONTRASENA_PRUEBA, newPassword: 'NuevaClave2026' });
    expect(cambio.status).toBe(204);

    expect((await login('recepcion', CONTRASENA_PRUEBA)).status).toBe(401);
    expect((await login('recepcion', 'NuevaClave2026')).status).toBe(200);
  });

  test('rechaza_una_contrasena_nueva_que_no_cumple_la_politica', async () => {
    const entrada = await login('mecanico');
    const cambio = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${entrada.body.data.token}`)
      .send({ currentPassword: CONTRASENA_PRUEBA, newPassword: 'corta' });
    expect(cambio.status).toBe(400);
    expect(cambio.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rechaza_el_cambio_si_la_contrasena_actual_es_incorrecta', async () => {
    const entrada = await login('mecanico');
    const cambio = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${entrada.body.data.token}`)
      .send({ currentPassword: 'Incorrecta2026', newPassword: 'NuevaClave2026' });
    expect(cambio.status).toBe(401);
  });
});
