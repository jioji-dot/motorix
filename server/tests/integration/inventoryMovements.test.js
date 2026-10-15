// Pruebas de integración de entradas, ajustes y movimientos de inventario (US6) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createMovement, createPart } from '../helpers/factories.js';

const app = createApp();

const entrada = (auth, id, cuerpo) =>
  request(app).post(`/api/parts/${id}/entries`).set('Authorization', auth).send(cuerpo);
const ajuste = (auth, id, cuerpo) =>
  request(app).post(`/api/parts/${id}/adjustments`).set('Authorization', auth).send(cuerpo);
const movimientos = (auth, id, consulta = '') =>
  request(app).get(`/api/parts/${id}/movements${consulta}`).set('Authorization', auth);

/** Comprueba la invariante: existencia = suma de movimientos para todas las refacciones. */
async function expectInvariante() {
  const [filas] = await pool.query(
    `SELECT p.id, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
     FROM parts p LEFT JOIN inventory_movements m ON m.part_id = p.id GROUP BY p.id`
  );
  for (const fila of filas) expect(Number(fila.suma)).toBe(fila.stock);
}

let auth;
let admin;

beforeEach(async () => {
  await cleanTables();
  ({ auth, user: admin } = await createAuthenticated('ADMIN'));
});
afterAll(closePool);

describe('entradas de mercancía', () => {
  test('test_la_entrada_suma_la_existencia_y_registra_un_movimiento_in_con_el_usuario', async () => {
    const pieza = await createPart({ stock: 4 });

    const res = await entrada(auth, pieza.id, { quantity: 6, reason: '  Compra a proveedor  ' });

    expect(res.status).toBe(201);
    expect(res.body.data.part.stock).toBe(10);
    expect(res.body.data.movement).toEqual(
      expect.objectContaining({
        type: 'IN',
        quantity: 6,
        reason: 'Compra a proveedor',
        orderId: null,
        createdBy: admin.id
      })
    );
    await expectInvariante();
  });

  test('test_una_entrada_que_supera_el_minimo_cambia_el_estado_de_existencia', async () => {
    const pieza = await createPart({ stock: 1, minimumStock: 3 });

    const res = await entrada(auth, pieza.id, { quantity: 10, reason: 'Compra' });

    expect(res.body.data.part.stockStatus).toBe('OK');
  });

  test.each([
    ['cantidad cero', { quantity: 0, reason: 'x' }, 'quantity'],
    ['cantidad negativa', { quantity: -2, reason: 'x' }, 'quantity'],
    ['cantidad no entera', { quantity: 1.5, reason: 'x' }, 'quantity'],
    ['cantidad en texto', { quantity: '3', reason: 'x' }, 'quantity'],
    ['motivo faltante', { quantity: 2 }, 'reason'],
    ['motivo vacío', { quantity: 2, reason: '   ' }, 'reason'],
    ['motivo demasiado largo', { quantity: 2, reason: 'x'.repeat(256) }, 'reason']
  ])('test_rechaza_entrada_con_%s', async (_nombre, cuerpo, campo) => {
    const pieza = await createPart({ stock: 4 });

    const res = await entrada(auth, pieza.id, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    expect((await movimientos(auth, pieza.id)).body.meta.total).toBe(1);
    await expectInvariante();
  });
});

describe('ajustes de existencia', () => {
  test('test_el_ajuste_a_la_baja_calcula_la_diferencia_negativa', async () => {
    const pieza = await createPart({ stock: 10 });

    const res = await ajuste(auth, pieza.id, { newStock: 6, reason: 'Conteo físico' });

    expect(res.status).toBe(201);
    expect(res.body.data.part.stock).toBe(6);
    expect(res.body.data.movement).toEqual(
      expect.objectContaining({ type: 'ADJUSTMENT', quantity: -4, reason: 'Conteo físico' })
    );
    await expectInvariante();
  });

  test('test_el_ajuste_al_alza_calcula_la_diferencia_positiva', async () => {
    const pieza = await createPart({ stock: 2 });

    const res = await ajuste(auth, pieza.id, { newStock: 9, reason: 'Se encontraron piezas' });

    expect(res.body.data.movement.quantity).toBe(7);
    expect(res.body.data.part.stock).toBe(9);
    await expectInvariante();
  });

  test('test_el_ajuste_a_cero_deja_la_refaccion_agotada', async () => {
    const pieza = await createPart({ stock: 5 });

    const res = await ajuste(auth, pieza.id, { newStock: 0, reason: 'Piezas defectuosas' });

    expect(res.status).toBe(201);
    expect(res.body.data.part.stockStatus).toBe('OUT');
  });

  test('test_un_ajuste_sin_diferencia_se_rechaza_y_no_registra_movimiento', async () => {
    const pieza = await createPart({ stock: 5 });

    const res = await ajuste(auth, pieza.id, { newStock: 5, reason: 'Conteo' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('newStock');
    expect((await movimientos(auth, pieza.id)).body.meta.total).toBe(1);
  });

  test.each([
    ['existencia negativa', { newStock: -1, reason: 'x' }, 'newStock'],
    ['existencia no entera', { newStock: 2.5, reason: 'x' }, 'newStock'],
    ['motivo faltante', { newStock: 3 }, 'reason'],
    ['motivo vacío', { newStock: 3, reason: '' }, 'reason']
  ])('test_rechaza_ajuste_con_%s', async (_nombre, cuerpo, campo) => {
    const pieza = await createPart({ stock: 5 });

    const res = await ajuste(auth, pieza.id, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    await expectInvariante();
  });

  test('test_entradas_y_ajustes_a_una_refaccion_inexistente_responden_404', async () => {
    expect((await entrada(auth, 9999, { quantity: 1, reason: 'x' })).status).toBe(404);
    expect((await ajuste(auth, 9999, { newStock: 1, reason: 'x' })).status).toBe(404);
  });

  test('test_se_pueden_ajustar_refacciones_inactivas', async () => {
    const pieza = await createPart({ stock: 5, active: 0 });

    const res = await ajuste(auth, pieza.id, { newStock: 4, reason: 'Conteo' });

    expect(res.status).toBe(201);
  });
});

describe('consulta de movimientos', () => {
  test('test_lista_del_mas_reciente_al_mas_antiguo_con_usuario_y_orden', async () => {
    const pieza = await createPart({ stock: 5 });
    await entrada(auth, pieza.id, { quantity: 3, reason: 'Compra' });
    await ajuste(auth, pieza.id, { newStock: 2, reason: 'Conteo' });

    const res = await movimientos(auth, pieza.id);

    expect(res.body.data.map((m) => m.type)).toEqual(['ADJUSTMENT', 'IN', 'IN']);
    expect(res.body.data.map((m) => m.quantity)).toEqual([-6, 3, 5]);
    expect(res.body.data[0].createdByName).toBe(admin.name);
    expect(res.body.meta.total).toBe(3);
  });

  test('test_pagina_los_movimientos', async () => {
    const pieza = await createPart({ stock: 1 });
    for (let i = 1; i <= 4; i += 1) await createMovement(pieza.id, { quantity: 1, reason: `Entrada ${i}` });

    const res = await movimientos(auth, pieza.id, '?page=2&pageSize=2');

    expect(res.body.data.map((m) => m.reason)).toEqual(['Entrada 2', 'Entrada 1']);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
  });

  test('test_solo_muestra_los_movimientos_de_la_refaccion_pedida', async () => {
    const a = await createPart({ stock: 1 });
    const b = await createPart({ stock: 7 });

    const res = await movimientos(auth, b.id);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].quantity).toBe(7);
    expect(a.id).not.toBe(b.id);
  });

  test('test_los_movimientos_de_una_refaccion_inexistente_responden_404', async () => {
    expect((await movimientos(auth, 9999)).status).toBe(404);
  });
});

describe('invariante de la existencia', () => {
  test('test_una_secuencia_mixta_mantiene_la_existencia_igual_a_la_suma_de_movimientos', async () => {
    const pieza = await createPart({ stock: 3 });

    await entrada(auth, pieza.id, { quantity: 12, reason: 'Compra' });
    await ajuste(auth, pieza.id, { newStock: 9, reason: 'Conteo' });
    await entrada(auth, pieza.id, { quantity: 1, reason: 'Devolución de cliente' });
    await ajuste(auth, pieza.id, { newStock: 20, reason: 'Conteo' });

    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(20);
    await expectInvariante();
  });
});

describe('permisos', () => {
  test.each(['RECEPTIONIST', 'MECHANIC'])('test_%s_recibe_403_en_entradas_ajustes_y_movimientos', async (rol) => {
    const { auth: otro } = await createAuthenticated(rol);
    const pieza = await createPart({ stock: 5 });

    const respuestas = await Promise.all([
      entrada(otro, pieza.id, { quantity: 1, reason: 'x' }),
      ajuste(otro, pieza.id, { newStock: 1, reason: 'x' }),
      movimientos(otro, pieza.id)
    ]);

    for (const res of respuestas) expect(res.status).toBe(403);
    await expectInvariante();
  });
});
