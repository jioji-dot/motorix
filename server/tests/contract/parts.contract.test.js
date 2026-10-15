// Pruebas de contrato de /api/parts (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createPart } from '../helpers/factories.js';

const app = createApp();

const FORMA_REFACCION = {
  id: expect.any(Number),
  code: expect.any(String),
  name: expect.any(String),
  description: null,
  price: expect.any(Number),
  stock: expect.any(Number),
  minimumStock: expect.any(Number),
  active: expect.any(Boolean),
  stockStatus: expect.stringMatching(/^(OK|LOW|OUT)$/),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de refacciones', () => {
  test('test_el_listado_devuelve_data_y_meta', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createPart({ code: 'FIL-01', name: 'Filtro de aceite', price: 120.5, stock: 8, minimumStock: 3 });

    const res = await request(app).get('/api/parts').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        ...FORMA_REFACCION,
        code: 'FIL-01',
        name: 'Filtro de aceite',
        price: 120.5,
        stock: 8,
        minimumStock: 3,
        active: true,
        stockStatus: 'OK'
      })
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_el_alta_responde_201_con_la_refaccion_creada', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app)
      .post('/api/parts')
      .set('Authorization', auth)
      .send({ code: 'bal-01', name: 'Balatas delanteras', price: 450, minimumStock: 4, initialStock: 10 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_REFACCION, code: 'BAL-01', stock: 10, minimumStock: 4, active: true })
    );
  });

  test('test_el_detalle_devuelve_la_refaccion', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const pieza = await createPart();

    const res = await request(app).get(`/api/parts/${pieza.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_REFACCION, id: pieza.id }));
  });

  test('test_la_edicion_responde_200_con_la_refaccion_actualizada', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const pieza = await createPart({ price: 100 });

    const res = await request(app)
      .patch(`/api/parts/${pieza.id}`)
      .set('Authorization', auth)
      .send({ name: 'Nombre nuevo', price: 130 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ name: 'Nombre nuevo', price: 130 }));
  });

  test('test_la_baja_y_la_reactivacion_devuelven_la_refaccion_con_active', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const pieza = await createPart();

    const baja = await request(app).post(`/api/parts/${pieza.id}/deactivate`).set('Authorization', auth);
    const alta = await request(app).post(`/api/parts/${pieza.id}/activate`).set('Authorization', auth);

    expect(baja.status).toBe(200);
    expect(baja.body.data.active).toBe(false);
    expect(alta.status).toBe(200);
    expect(alta.body.data.active).toBe(true);
  });

  test('test_un_codigo_repetido_responde_409_part_code_duplicate', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    await createPart({ code: 'DUP-01' });

    const res = await request(app)
      .post('/api/parts')
      .set('Authorization', auth)
      .send({ code: 'DUP-01', name: 'Otra', price: 10 });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual(
      expect.objectContaining({ code: 'PART_CODE_DUPLICATE', message: expect.any(String) })
    );
    expect(res.body.error.details).toEqual({ field: 'code' });
  });

  test('test_los_datos_invalidos_responden_400_validation_error_con_details', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app)
      .post('/api/parts')
      .set('Authorization', auth)
      .send({ code: '', name: '', price: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: expect.any(String), message: expect.any(String) })])
    );
  });

  test('test_una_refaccion_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/parts/9999').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
