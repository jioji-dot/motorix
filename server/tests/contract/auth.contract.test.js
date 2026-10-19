// Contrato de la API de autenticación (specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { CONTRASENA_PRUEBA, cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});

afterAll(cerrarConexiones);

describe('POST /api/auth/login', () => {
  test('responde_200_con_token_expiresIn_y_usuario_publico', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin', password: CONTRASENA_PRUEBA });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: {
        token: expect.any(String),
        expiresIn: 28800,
        user: {
          id: usuarios.ADMIN.id,
          username: 'admin',
          name: expect.any(String),
          email: 'admin@motorix.test',
          role: 'ADMIN',
        },
      },
    });
  });

  test('responde_401_con_forma_de_error_estandar_y_sin_trazas', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin', password: 'Incorrecta2026' });
    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: expect.any(String) },
    });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/stack|at .*\.js/i);
  });

  test('responde_400_con_detalles_por_campo_cuando_faltan_datos', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'identifier', message: expect.any(String) })]),
    );
  });

  test('responde_400_si_el_cuerpo_no_es_un_json_valido', async () => {
    const respuesta = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ no es json');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  test('responde_200_con_el_usuario_de_la_sesion', async () => {
    const respuesta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${usuarios.MECHANIC.token}`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      id: usuarios.MECHANIC.id,
      username: 'mecanico',
      name: expect.any(String),
      email: 'mecanico@motorix.test',
      role: 'MECHANIC',
    });
  });

  test('responde_401_sin_token', async () => {
    const respuesta = await request(app).get('/api/auth/me');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/change-password', () => {
  test('responde_204_sin_contenido_cuando_el_cambio_es_valido', async () => {
    const respuesta = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${usuarios.RECEPTIONIST.token}`)
      .send({ currentPassword: CONTRASENA_PRUEBA, newPassword: 'OtraClave2026' });
    expect(respuesta.status).toBe(204);
    expect(respuesta.text).toBe('');
  });

  test('responde_400_cuando_la_politica_no_se_cumple_indicando_el_campo', async () => {
    const respuesta = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${usuarios.ADMIN.token}`)
      .send({ currentPassword: CONTRASENA_PRUEBA, newPassword: 'sinnumero' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details[0].field).toBe('newPassword');
  });

  test('responde_401_sin_token', async () => {
    const respuesta = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'x', newPassword: 'OtraClave2026' });
    expect(respuesta.status).toBe(401);
  });
});
