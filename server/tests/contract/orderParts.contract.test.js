// Pruebas de contrato de las refacciones de la orden y de /api/parts/available
// (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createPart } from '../helpers/factories.js';

const app = createApp();

const FORMA_LINEA = {
  id: expect.any(Number),
  partId: expect.any(Number),
  code: expect.any(String),
  name: expect.any(String),
  quantity: expect.any(Number),
  unitPrice: expect.any(Number),
  amount: expect.any(Number)
};

let mecanico;
let orden;
let pieza;

beforeEach(async () => {
  await cleanTables();
  mecanico = await createAuthenticated('MECHANIC');
  orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });
  pieza = await createPart({ code: 'FIL-01', name: 'Filtro de aceite', price: 120, stock: 10 });
});
afterAll(closePool);

describe('contrato de refacciones de la orden', () => {
  test('test_agregar_responde_200_con_el_detalle_de_la_orden_y_la_linea', async () => {
    const res = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.parts).toEqual([
      expect.objectContaining({
        ...FORMA_LINEA,
        partId: pieza.id,
        code: 'FIL-01',
        name: 'Filtro de aceite',
        quantity: 2,
        unitPrice: 120,
        amount: 240
      })
    ]);
    expect(res.body.data.partsSubtotal).toBe(240);
    expect(res.body.data.total).toBe(240);
    expect(res.body.data.editable.parts).toBe(true);
  });

  test('test_el_detalle_incluye_parts_partssubtotal_serviceMileage_y_editable_parts', async () => {
    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', mecanico.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        parts: [],
        partsSubtotal: 0,
        serviceMileage: null,
        editable: expect.objectContaining({ parts: true })
      })
    );
  });

  test('test_cambiar_la_cantidad_responde_200_con_la_orden_actualizada', async () => {
    const agregada = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 2 });
    const lineaId = agregada.body.data.parts[0].id;

    const res = await request(app)
      .patch(`/api/orders/${orden.id}/parts/${lineaId}`)
      .set('Authorization', mecanico.auth)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.parts[0]).toEqual(expect.objectContaining({ quantity: 5, amount: 600 }));
  });

  test('test_quitar_responde_200_con_la_orden_sin_la_linea', async () => {
    const agregada = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 2 });
    const lineaId = agregada.body.data.parts[0].id;

    const res = await request(app)
      .delete(`/api/orders/${orden.id}/parts/${lineaId}`)
      .set('Authorization', mecanico.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.parts).toEqual([]);
    expect(res.body.data.partsSubtotal).toBe(0);
  });

  test('test_la_existencia_insuficiente_responde_409_con_details', async () => {
    const res = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 11 });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'INSUFFICIENT_STOCK',
      message: expect.any(String),
      details: { partId: pieza.id, available: 10, requested: 11 }
    });
  });

  test('test_una_refaccion_inactiva_responde_409_part_inactive', async () => {
    const inactiva = await createPart({ active: 0, stock: 5 });

    const res = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: inactiva.id, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PART_INACTIVE');
  });

  test('test_los_datos_invalidos_responden_400_validation_error', async () => {
    const res = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'quantity' })])
    );
  });
});

describe('contrato de refacciones disponibles', () => {
  test('test_available_devuelve_solo_los_campos_publicos', async () => {
    const res = await request(app)
      .get('/api/parts/available?search=filtro')
      .set('Authorization', mecanico.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: pieza.id, code: 'FIL-01', name: 'Filtro de aceite', price: 120, stock: 10 }
    ]);
  });
});
