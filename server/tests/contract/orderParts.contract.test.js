// Contrato de POST, PATCH y DELETE /api/orders/:id/parts (specs/003-.../contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
// Sprint 5 (FR-008, H-07): el mecánico no recibe el total; se lee con recepción, que sí lo recibe.
const totalDe = async (orden) => (await request(app).get(`/api/orders/${orden}`).set(como('RECEPTIONIST'))).body.data.total;
const nuevaOrden = (status = 'EN_REPARACION') =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('POST /api/orders/:id/parts', () => {
  test('responde_201_con_la_orden_completa_con_parts_y_total', async () => {
    const orden = await nuevaOrden();
    const { id: partId, code } = await crearRefaccion({ stock: 5, salePrice: 150 });
    const respuesta = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 2 });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      id: orden,
      parts: [{ id: expect.any(Number), partId, code, name: expect.any(String), quantity: 2 }],
      allowedTransitions: expect.any(Array),
    });
    expect(respuesta.body.data).not.toHaveProperty('total');
    expect(respuesta.body.data.parts[0]).not.toHaveProperty('unitPrice');
    expect(respuesta.body.data.parts[0]).not.toHaveProperty('amount');
    expect(await totalDe(orden)).toBe('300.00');
  });

  test('responde_400_404_y_403_con_error_estandar', async () => {
    const orden = await nuevaOrden();
    const { id: partId } = await crearRefaccion();
    const mala = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 0 });
    expect(mala.status).toBe(400);
    expect(mala.body.error.details[0].field).toBe('quantity');
    const sinParte = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: 999999, quantity: 1 });
    expect(sinParte.status).toBe(404);
    const sinOrden = await request(app).post('/api/orders/999999/parts').set(como('ADMIN')).send({ partId, quantity: 1 });
    expect(sinOrden.status).toBe(404);
    const recepcion = await request(app).post(`/api/orders/${orden}/parts`).set(como('RECEPTIONIST')).send({ partId, quantity: 1 });
    expect(recepcion.status).toBe(403);
    expect(recepcion.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  test('responde_409_con_los_codigos_documentados', async () => {
    const orden = await nuevaOrden();
    const { id: partId } = await crearRefaccion({ stock: 2 });
    const { id: inactiva } = await crearRefaccion({ stock: 2, active: 0 });
    const corto = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 3 });
    expect(corto.status).toBe(409);
    expect(corto.body).toEqual({ error: { code: 'INSUFFICIENT_STOCK', message: expect.any(String), available: 2 } });
    const off = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId: inactiva, quantity: 1 });
    expect(off.body.error.code).toBe('PART_INACTIVE');
    await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 1 });
    const repetida = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 1 });
    expect(repetida.body.error.code).toBe('DUPLICATE_ORDER_PART');
    const cerrada = await nuevaOrden('TERMINADO');
    const noEditable = await request(app).post(`/api/orders/${cerrada}/parts`).set(como('MECHANIC')).send({ partId, quantity: 1 });
    expect(noEditable.body.error.code).toBe('ORDER_NOT_EDITABLE');
  });

  test('ignora_un_precio_enviado_y_usa_el_de_venta_vigente', async () => {
    const orden = await nuevaOrden();
    const { id: partId } = await crearRefaccion({ stock: 5, salePrice: 200 });
    const respuesta = await request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId, quantity: 1, unitPrice: 1 });
    expect(respuesta.body.data.parts[0].unitPrice).toBe('200.00');
  });
});

describe('PATCH y DELETE /api/orders/:id/parts/:lineId', () => {
  test('PATCH_responde_200_con_la_orden_y_404_si_la_linea_no_es_de_la_orden', async () => {
    const orden = await nuevaOrden();
    const otra = await nuevaOrden();
    const { id: partId } = await crearRefaccion({ stock: 9, salePrice: 10 });
    const alta = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 2 });
    const lineId = alta.body.data.parts[0].id;
    const ok = await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('MECHANIC')).send({ quantity: 4 });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ parts: [{ quantity: 4 }] });
    expect(ok.body.data).not.toHaveProperty('total');
    expect(await totalDe(orden)).toBe('40.00');
    const ajena = await request(app).patch(`/api/orders/${otra}/parts/${lineId}`).set(como('MECHANIC')).send({ quantity: 1 });
    expect(ajena.status).toBe(404);
    const mala = await request(app).patch(`/api/orders/${orden}/parts/${lineId}`).set(como('MECHANIC')).send({ quantity: -1 });
    expect(mala.status).toBe(400);
  });

  test('DELETE_responde_200_con_la_orden_sin_la_refaccion', async () => {
    const orden = await nuevaOrden();
    const { id: partId } = await crearRefaccion({ stock: 3, salePrice: 10 });
    const alta = await request(app).post(`/api/orders/${orden}/parts`).set(como('MECHANIC')).send({ partId, quantity: 1 });
    const respuesta = await request(app).delete(`/api/orders/${orden}/parts/${alta.body.data.parts[0].id}`).set(como('MECHANIC'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ parts: [] });
    expect(respuesta.body.data).not.toHaveProperty('total');
    expect(await totalDe(orden)).toBe('0.00');
  });
});

describe('Límite de importes en las refacciones de una orden (Sprint 5)', () => {
  test('un_importe_mayor_al_maximo_responde_409_AMOUNT_LIMIT_EXCEEDED_con_el_error_estandar', async () => {
    const orden = await nuevaOrden();
    const { id: partId } = await crearRefaccion({ stock: 5, purchasePrice: 1, salePrice: 99999999.99 });
    const respuesta = await request(app).post(`/api/orders/${orden}/parts`).set(como('ADMIN')).send({ partId, quantity: 2 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: {
        code: 'AMOUNT_LIMIT_EXCEEDED',
        message: expect.stringContaining('99,999,999.99'),
        details: [{ field: 'quantity', message: expect.any(String) }],
      },
    });
  });
});
