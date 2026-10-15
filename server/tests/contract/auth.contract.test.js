// Pruebas de contrato de la API de autenticación (ver specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { TEST_PASSWORD, createAuthenticated, createUser } from '../helpers/factories.js';

const app = createApp();

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de autenticación', () => {
  test('test_login_responde_con_token_expiracion_y_usuario_sin_datos_de_contrasena', async () => {
    const usuario = await createUser({ username: 'recepcion', role: 'RECEPTIONIST' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'recepcion', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      token: expect.any(String),
      expiresIn: 28800,
      user: {
        id: usuario.id,
        username: 'recepcion',
        name: usuario.name,
        email: usuario.email,
        role: 'RECEPTIONIST'
      }
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('test_login_con_credenciales_invalidas_usa_el_formato_de_error_del_contrato', async () => {
    await createUser({ username: 'recepcion' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'recepcion', password: 'Incorrecta1' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: expect.any(String) }
    });
  });

  test('test_login_con_cuerpo_incompleto_responde_400_con_detalle_por_campo', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'recepcion' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })])
    );
  });

  test('test_me_devuelve_el_perfil_del_usuario_autenticado', async () => {
    const { user, auth } = await createAuthenticated('MECHANIC');

    const res = await request(app).get('/api/auth/me').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: 'MECHANIC'
    });
  });

  test('test_cambiar_contrasena_responde_204_sin_cuerpo', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', auth)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'NuevaClave2026' });

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  test('test_cuenta_bloqueada_responde_423_con_segundos_de_espera', async () => {
    await createUser({ username: 'bloqueado' });
    for (let i = 0; i < 4; i += 1) {
      await request(app).post('/api/auth/login').send({ identifier: 'bloqueado', password: 'Mala1234' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'bloqueado', password: 'Mala1234' });

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});
