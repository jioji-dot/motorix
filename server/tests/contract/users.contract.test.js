// Contrato de /api/users (specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let admin;
const auth = () => ({ Authorization: `Bearer ${admin.token}` });

const FORMA_USUARIO = {
  id: expect.any(Number),
  username: expect.any(String),
  name: expect.any(String),
  email: expect.any(String),
  role: expect.stringMatching(/^(ADMIN|RECEPTIONIST|MECHANIC)$/),
  active: expect.any(Boolean),
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
};

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
});

afterAll(cerrarConexiones);

const NUEVO = { username: 'contrato', name: 'Usuario Contrato', email: 'contrato@motorix.test', role: 'RECEPTIONIST', password: 'Contrato2026' };

describe('POST /api/users', () => {
  test('responde_201_con_el_usuario_sin_datos_sensibles', async () => {
    const respuesta = await request(app).post('/api/users').set(auth()).send(NUEVO);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ data: { ...FORMA_USUARIO, username: 'contrato', role: 'RECEPTIONIST', active: true } });
  });

  test('responde_400_con_detalles_por_campo', async () => {
    const respuesta = await request(app).post('/api/users').set(auth()).send({ username: 'a' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['username', 'name', 'email', 'role', 'password']),
    );
  });

  test('responde_409_DUPLICATE_VALUE_con_el_campo_repetido', async () => {
    const respuesta = await request(app).post('/api/users').set(auth()).send(NUEVO);
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: { code: 'DUPLICATE_VALUE', message: expect.any(String), details: [{ field: 'username', message: expect.any(String) }] },
    });
  });

  test('responde_401_con_un_token_invalido', async () => {
    const invalido = await request(app).get('/api/users').set({ Authorization: 'Bearer invalido' });
    expect(invalido.status).toBe(401);
  });
});

describe('GET /api/users', () => {
  test('responde_200_con_data_y_meta', async () => {
    const respuesta = await request(app).get('/api/users?page=1&pageSize=10').set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual(expect.arrayContaining([expect.objectContaining(FORMA_USUARIO)]));
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 10, total: 4 });
  });

  test('acepta_los_filtros_role_y_active', async () => {
    const respuesta = await request(app).get('/api/users?role=ADMIN&active=true').set(auth());
    expect(respuesta.body.data.every((u) => u.role === 'ADMIN' && u.active === true)).toBe(true);
    expect((await request(app).get('/api/users?role=OTRO').set(auth())).status).toBe(400);
  });
});

describe('GET /api/users/:id', () => {
  test('responde_200_con_el_usuario', async () => {
    const respuesta = await request(app).get(`/api/users/${admin.id}`).set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: { ...FORMA_USUARIO, username: 'admin', role: 'ADMIN' } });
  });

  test('responde_404_con_error_estandar', async () => {
    const respuesta = await request(app).get('/api/users/987654').set(auth());
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });
});

describe('PATCH /api/users/:id', () => {
  test('responde_200_con_el_usuario_actualizado', async () => {
    const lista = await request(app).get('/api/users?search=contrato').set(auth());
    const respuesta = await request(app)
      .patch(`/api/users/${lista.body.data[0].id}`)
      .set(auth())
      .send({ name: 'Nombre Actualizado' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ ...FORMA_USUARIO, name: 'Nombre Actualizado', username: 'contrato' });
  });

  test('responde_409_LAST_ADMIN_al_desactivar_al_unico_administrador', async () => {
    const respuesta = await request(app).patch(`/api/users/${admin.id}`).set(auth()).send({ active: false });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: { code: 'LAST_ADMIN', message: expect.any(String) } });
  });

  test('responde_400_si_no_se_envia_ningun_campo', async () => {
    const respuesta = await request(app).patch(`/api/users/${admin.id}`).set(auth()).send({});
    expect(respuesta.status).toBe(400);
  });
});
