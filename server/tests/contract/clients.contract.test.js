// Contrato de /api/clients (specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let admin;
const auth = () => ({ Authorization: `Bearer ${admin.token}` });

const FORMA_CLIENTE = {
  id: expect.any(Number),
  name: expect.any(String),
  phone: expect.stringMatching(/^\d{10}$/),
  email: null,
  active: true,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
};

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
});

afterAll(cerrarConexiones);

describe('POST /api/clients', () => {
  test('responde_201_con_el_cliente_creado', async () => {
    const respuesta = await request(app)
      .post('/api/clients')
      .set(auth())
      .send({ name: 'Contrato Uno', phone: '5500000001' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ data: { ...FORMA_CLIENTE, name: 'Contrato Uno', phone: '5500000001' } });
  });

  test('responde_400_con_detalles_por_campo', async () => {
    const respuesta = await request(app).post('/api/clients').set(auth()).send({ phone: '123' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    const campos = respuesta.body.error.details.map((d) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['name', 'phone']));
  });

  test('responde_409_DUPLICATE_PHONE_con_las_coincidencias_en_details', async () => {
    const respuesta = await request(app)
      .post('/api/clients')
      .set(auth())
      .send({ name: 'Otro', phone: '5500000001' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: {
        code: 'DUPLICATE_PHONE',
        message: expect.any(String),
        details: [{ id: expect.any(Number), name: 'Contrato Uno', phone: '5500000001' }],
      },
    });
  });
});

describe('GET /api/clients', () => {
  test('responde_200_con_data_y_meta_de_paginacion', async () => {
    const respuesta = await request(app).get('/api/clients?page=1&pageSize=5').set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual(expect.arrayContaining([expect.objectContaining(FORMA_CLIENTE)]));
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 5, total: expect.any(Number) });
  });

  test('responde_400_si_la_paginacion_no_es_valida', async () => {
    const respuesta = await request(app).get('/api/clients?pageSize=1000').set(auth());
    expect(respuesta.status).toBe(400);
  });
});

describe('GET /api/clients/:id', () => {
  test('responde_200_con_el_cliente_y_el_arreglo_vehicles', async () => {
    const lista = await request(app).get('/api/clients').set(auth());
    const id = lista.body.data[0].id;
    const respuesta = await request(app).get(`/api/clients/${id}`).set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ ...FORMA_CLIENTE, vehicles: [] });
  });

  test('responde_404_con_forma_de_error_estandar', async () => {
    const respuesta = await request(app).get('/api/clients/987654').set(auth());
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });
});

describe('PATCH /api/clients/:id', () => {
  test('responde_200_con_el_cliente_actualizado', async () => {
    const lista = await request(app).get('/api/clients').set(auth());
    const id = lista.body.data[0].id;
    const respuesta = await request(app).patch(`/api/clients/${id}`).set(auth()).send({ name: 'Nombre Editado' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ ...FORMA_CLIENTE, name: 'Nombre Editado' });
  });

  test('responde_400_si_no_se_envia_ningun_campo', async () => {
    const lista = await request(app).get('/api/clients').set(auth());
    const respuesta = await request(app).patch(`/api/clients/${lista.body.data[0].id}`).set(auth()).send({});
    expect(respuesta.status).toBe(400);
  });
});
