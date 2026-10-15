// Pruebas de contrato de /api/users (ver specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createUser } from '../helpers/factories.js';

const app = createApp();

const FORMA_USUARIO = {
  id: expect.any(Number),
  username: expect.any(String),
  name: expect.any(String),
  email: expect.any(String),
  role: expect.stringMatching(/^(ADMIN|RECEPTIONIST|MECHANIC)$/),
  active: expect.any(Boolean),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de usuarios', () => {
  test('test_el_listado_devuelve_usuarios_con_meta_y_sin_datos_de_contrasena', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createUser({ role: 'MECHANIC' });

    const res = await request(app).get('/api/users').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const usuario of res.body.data) {
      expect(Object.keys(usuario).sort()).toEqual(Object.keys(FORMA_USUARIO).sort());
      expect(usuario).toEqual(expect.objectContaining(FORMA_USUARIO));
    }
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|failed|locked/i);
  });

  test('test_el_alta_responde_201_con_el_usuario_creado', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).post('/api/users').set('Authorization', auth).send({
      username: 'nuevo.usuario',
      name: 'Nuevo Usuario',
      email: 'nuevo@motorix.local',
      role: 'MECHANIC',
      password: 'Taller2026'
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        ...FORMA_USUARIO,
        username: 'nuevo.usuario',
        role: 'MECHANIC',
        active: true
      })
    );
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('test_el_detalle_responde_el_usuario', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ role: 'RECEPTIONIST' });

    const res = await request(app).get(`/api/users/${otro.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_USUARIO, id: otro.id }));
  });

  test('test_la_edicion_responde_200_con_el_usuario_actualizado', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser({ role: 'RECEPTIONIST' });

    const res = await request(app)
      .patch(`/api/users/${otro.id}`)
      .set('Authorization', auth)
      .send({ name: 'Nombre Nuevo', role: 'MECHANIC', active: false });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_USUARIO, name: 'Nombre Nuevo', role: 'MECHANIC', active: false })
    );
  });

  test('test_restablecer_la_contrasena_responde_204_sin_cuerpo', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const otro = await createUser();

    const res = await request(app)
      .post(`/api/users/${otro.id}/reset-password`)
      .set('Authorization', auth)
      .send({ newPassword: 'Nueva2026Clave' });

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  test('test_un_rol_no_autorizado_recibe_403_con_el_formato_de_error', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await request(app).get('/api/users').set('Authorization', auth);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });
});
