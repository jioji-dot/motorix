// Contrato de /api/vehicles (specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let admin;
let clientId;
const auth = () => ({ Authorization: `Bearer ${admin.token}` });

const FORMA_VEHICULO = {
  id: expect.any(Number),
  clientId: expect.any(Number),
  brand: expect.any(String),
  model: expect.any(String),
  year: expect.any(Number),
  licensePlate: expect.any(String),
  vin: null,
  currentMileage: expect.any(Number),
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  client: { id: expect.any(Number), name: expect.any(String), phone: expect.stringMatching(/^\d{10}$/) },
};

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
  const cliente = await request(app).post('/api/clients').set(auth()).send({ name: 'Dueño Contrato', phone: '5500000009' });
  clientId = cliente.body.data.id;
});

afterAll(cerrarConexiones);

const NUEVO = { brand: 'Kia', model: 'Rio', year: 2021, licensePlate: 'CON-001', currentMileage: 12000 };

describe('POST /api/vehicles', () => {
  test('responde_201_con_el_vehiculo_y_el_resumen_del_propietario', async () => {
    const respuesta = await request(app).post('/api/vehicles').set(auth()).send({ ...NUEVO, clientId });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ data: { ...FORMA_VEHICULO, clientId, licensePlate: 'CON-001' } });
  });

  test('responde_400_con_detalles_cuando_falta_el_propietario', async () => {
    const respuesta = await request(app).post('/api/vehicles').set(auth()).send(NUEVO);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details.map((d) => d.field)).toContain('clientId');
  });

  test('responde_404_con_error_estandar_si_el_cliente_no_existe', async () => {
    const respuesta = await request(app)
      .post('/api/vehicles')
      .set(auth())
      .send({ ...NUEVO, licensePlate: 'CON-404', clientId: 987654 });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('responde_409_DUPLICATE_VALUE_indicando_el_campo_repetido', async () => {
    const respuesta = await request(app).post('/api/vehicles').set(auth()).send({ ...NUEVO, clientId });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: {
        code: 'DUPLICATE_VALUE',
        message: expect.any(String),
        details: [{ field: 'licensePlate', message: expect.any(String) }],
      },
    });
  });
});

describe('GET /api/vehicles', () => {
  test('responde_200_con_data_y_meta_de_paginacion', async () => {
    const respuesta = await request(app).get('/api/vehicles?page=1&pageSize=10').set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([expect.objectContaining(FORMA_VEHICULO)]);
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 10, total: 1 });
  });
});

describe('GET /api/vehicles/:id', () => {
  test('responde_200_con_el_vehiculo_y_client_con_id_name_y_phone', async () => {
    const lista = await request(app).get('/api/vehicles').set(auth());
    const respuesta = await request(app).get(`/api/vehicles/${lista.body.data[0].id}`).set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual(FORMA_VEHICULO);
  });

  test('responde_404_si_no_existe', async () => {
    const respuesta = await request(app).get('/api/vehicles/987654').set(auth());
    expect(respuesta.status).toBe(404);
  });
});

describe('PATCH /api/vehicles/:id', () => {
  test('responde_200_con_el_vehiculo_actualizado', async () => {
    const lista = await request(app).get('/api/vehicles').set(auth());
    const respuesta = await request(app)
      .patch(`/api/vehicles/${lista.body.data[0].id}`)
      .set(auth())
      .send({ currentMileage: 13000 });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ ...FORMA_VEHICULO, currentMileage: 13000, licensePlate: 'CON-001' });
  });

  test('responde_409_MILEAGE_DECREASE_al_bajar_el_kilometraje', async () => {
    const lista = await request(app).get('/api/vehicles').set(auth());
    const respuesta = await request(app)
      .patch(`/api/vehicles/${lista.body.data[0].id}`)
      .set(auth())
      .send({ currentMileage: 100 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('MILEAGE_DECREASE');
  });

  test('responde_400_si_no_se_envia_ningun_campo', async () => {
    const lista = await request(app).get('/api/vehicles').set(auth());
    const respuesta = await request(app).patch(`/api/vehicles/${lista.body.data[0].id}`).set(auth()).send({});
    expect(respuesta.status).toBe(400);
  });
});
