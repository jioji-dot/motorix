// Pruebas de contrato de entradas, ajustes y movimientos de inventario
// (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createMovement, createPart } from '../helpers/factories.js';

const app = createApp();

const FORMA_MOVIMIENTO = {
  id: expect.any(Number),
  partId: expect.any(Number),
  type: expect.stringMatching(/^(IN|OUT|ADJUSTMENT)$/),
  quantity: expect.any(Number),
  reason: expect.any(String),
  orderId: null,
  orderFolio: null,
  createdBy: expect.any(Number),
  createdByName: expect.any(String),
  createdAt: expect.any(String)
};

let auth;

beforeEach(async () => {
  await cleanTables();
  ({ auth } = await createAuthenticated('ADMIN'));
});
afterAll(closePool);

describe('contrato de movimientos de inventario', () => {
  test('test_la_entrada_responde_201_con_la_refaccion_y_el_movimiento', async () => {
    const pieza = await createPart({ stock: 5 });

    const res = await request(app)
      .post(`/api/parts/${pieza.id}/entries`)
      .set('Authorization', auth)
      .send({ quantity: 10, reason: 'Compra a proveedor' });

    expect(res.status).toBe(201);
    expect(res.body.data.part).toEqual(expect.objectContaining({ id: pieza.id, stock: 15 }));
    expect(res.body.data.movement).toEqual(
      expect.objectContaining({ ...FORMA_MOVIMIENTO, type: 'IN', quantity: 10, reason: 'Compra a proveedor' })
    );
  });

  test('test_el_ajuste_responde_201_con_el_movimiento_con_signo', async () => {
    const pieza = await createPart({ stock: 10 });

    const res = await request(app)
      .post(`/api/parts/${pieza.id}/adjustments`)
      .set('Authorization', auth)
      .send({ newStock: 7, reason: 'Conteo físico' });

    expect(res.status).toBe(201);
    expect(res.body.data.part.stock).toBe(7);
    expect(res.body.data.movement).toEqual(
      expect.objectContaining({ ...FORMA_MOVIMIENTO, type: 'ADJUSTMENT', quantity: -3 })
    );
  });

  test('test_el_listado_de_movimientos_devuelve_data_y_meta', async () => {
    const pieza = await createPart({ stock: 5 });
    await createMovement(pieza.id, { type: 'IN', quantity: 3, reason: 'Compra' });

    const res = await request(app).get(`/api/parts/${pieza.id}/movements`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ ...FORMA_MOVIMIENTO, quantity: 3, reason: 'Compra' }),
      expect.objectContaining({ ...FORMA_MOVIMIENTO, quantity: 5, reason: 'Existencia inicial' })
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  test('test_un_motivo_faltante_responde_400_validation_error', async () => {
    const pieza = await createPart();

    const res = await request(app)
      .post(`/api/parts/${pieza.id}/entries`)
      .set('Authorization', auth)
      .send({ quantity: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'reason', message: expect.any(String) })])
    );
  });

  test('test_una_refaccion_inexistente_responde_404', async () => {
    const res = await request(app)
      .post('/api/parts/9999/entries')
      .set('Authorization', auth)
      .send({ quantity: 1, reason: 'x' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
