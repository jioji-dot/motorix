// Pruebas de contrato de /api/vehicles (ver specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createClient, createVehicle } from '../helpers/factories.js';

const app = createApp();

const FORMA_VEHICULO = {
  id: expect.any(Number),
  clientId: expect.any(Number),
  brand: expect.any(String),
  model: expect.any(String),
  year: expect.any(Number),
  licensePlate: expect.any(String),
  vin: null,
  color: null,
  currentMileage: expect.any(Number),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de vehículos', () => {
  test('test_el_listado_incluye_el_nombre_del_propietario_y_meta', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const cliente = await createClient({ name: 'Ana Pérez' });
    await createVehicle(cliente.id);

    const res = await request(app).get('/api/vehicles').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ ...FORMA_VEHICULO, ownerName: 'Ana Pérez' })
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_el_alta_responde_201_con_el_vehiculo_creado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const res = await request(app).post('/api/vehicles').set('Authorization', auth).send({
      clientId: cliente.id,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2021,
      licensePlate: 'xyz-987'
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        ...FORMA_VEHICULO,
        clientId: cliente.id,
        brand: 'Toyota',
        licensePlate: 'XYZ987',
        currentMileage: 0
      })
    );
  });

  test('test_el_detalle_incluye_el_propietario', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5512345678' });
    const vehiculo = await createVehicle(cliente.id);

    const res = await request(app).get(`/api/vehicles/${vehiculo.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        ...FORMA_VEHICULO,
        owner: { id: cliente.id, name: 'Ana Pérez', phone: '5512345678' }
      })
    );
  });

  test('test_la_edicion_responde_200_con_el_vehiculo_actualizado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    const res = await request(app)
      .patch(`/api/vehicles/${vehiculo.id}`)
      .set('Authorization', auth)
      .send({ color: 'Rojo' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_VEHICULO, color: 'Rojo' }));
  });

  test('test_los_errores_de_duplicado_indican_el_campo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    await createVehicle(cliente.id, { licensePlate: 'ABC123' });

    const res = await request(app).post('/api/vehicles').set('Authorization', auth).send({
      clientId: cliente.id,
      brand: 'Kia',
      model: 'Rio',
      year: 2019,
      licensePlate: 'ABC123'
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'DUPLICATE_LICENSE_PLATE',
        message: expect.any(String),
        details: { field: 'licensePlate' }
      }
    });
  });
});
