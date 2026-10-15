// Pruebas de contrato de /api/clients (ver specs/001-base-clientes-vehiculos/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createClient, createVehicle } from '../helpers/factories.js';

const app = createApp();

const FORMA_CLIENTE = {
  id: expect.any(Number),
  name: expect.any(String),
  phone: expect.any(String),
  email: null,
  address: null,
  active: true,
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de clientes', () => {
  test('test_el_listado_devuelve_data_y_meta_de_paginacion', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createClient({ name: 'Ana Pérez' });

    const res = await request(app).get('/api/clients').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining(FORMA_CLIENTE)]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_el_alta_responde_201_con_el_cliente_creado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', auth)
      .send({ name: 'Luis Gómez', phone: '5512345678' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_CLIENTE, name: 'Luis Gómez', phone: '5512345678' })
    );
  });

  test('test_el_detalle_incluye_el_arreglo_de_vehiculos', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const cliente = await createClient();
    await createVehicle(cliente.id, { licensePlate: 'ABC123' });

    const res = await request(app).get(`/api/clients/${cliente.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        ...FORMA_CLIENTE,
        vehicles: [
          expect.objectContaining({
            id: expect.any(Number),
            clientId: cliente.id,
            brand: 'Nissan',
            model: 'Versa',
            year: 2020,
            licensePlate: 'ABC123',
            vin: null,
            color: null,
            currentMileage: 0
          })
        ]
      })
    );
  });

  test('test_un_cliente_inexistente_responde_404_con_el_formato_de_error', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/clients/9999').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('test_la_edicion_responde_200_con_el_cliente_actualizado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5512345678' });

    const res = await request(app)
      .patch(`/api/clients/${cliente.id}`)
      .set('Authorization', auth)
      .send({ phone: '5599999999' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_CLIENTE, id: cliente.id, name: 'Ana Pérez', phone: '5599999999' })
    );
  });

  test('test_la_edicion_con_datos_invalidos_responde_400_con_detalle_por_campo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();

    const res = await request(app)
      .patch(`/api/clients/${cliente.id}`)
      .set('Authorization', auth)
      .send({ email: 'no-es-correo' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })])
    );
  });

  test('test_la_validacion_fallida_lista_cada_campo_en_details', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).post('/api/clients').set('Authorization', auth).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const campos = res.body.error.details.map((d) => d.field);
    expect(campos).toEqual(expect.arrayContaining(['name', 'phone']));
  });
});
