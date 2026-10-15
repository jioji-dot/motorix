// Pruebas de integración de las refacciones de la orden (US7) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createOrder,
  createOrderPart,
  createOrderService,
  createPart
} from '../helpers/factories.js';

const app = createApp();

const agregar = (auth, id, cuerpo) =>
  request(app).post(`/api/orders/${id}/parts`).set('Authorization', auth).send(cuerpo);
const cambiar = (auth, id, lineaId, cuerpo) =>
  request(app).patch(`/api/orders/${id}/parts/${lineaId}`).set('Authorization', auth).send(cuerpo);
const quitar = (auth, id, lineaId) =>
  request(app).delete(`/api/orders/${id}/parts/${lineaId}`).set('Authorization', auth);
const detalle = (auth, id) => request(app).get(`/api/orders/${id}`).set('Authorization', auth);

const existencia = async (partId) => {
  const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [partId]);
  return fila.stock;
};
const movimientosDe = async (partId) => {
  const [filas] = await pool.query(
    'SELECT type, quantity, reason, order_id FROM inventory_movements WHERE part_id = ? ORDER BY id',
    [partId]
  );
  return filas;
};
async function expectInvariante() {
  const [filas] = await pool.query(
    `SELECT p.id, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
     FROM parts p LEFT JOIN inventory_movements m ON m.part_id = p.id GROUP BY p.id`
  );
  for (const fila of filas) expect(Number(fila.suma)).toBe(fila.stock);
}

const ESTADOS_DE_TRABAJO = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'];

let mecanico;
let orden;
let pieza;

beforeEach(async () => {
  await cleanTables();
  mecanico = await createAuthenticated('MECHANIC');
  orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });
  pieza = await createPart({ code: 'FIL-01', price: 120, stock: 10, minimumStock: 3 });
});
afterAll(closePool);

describe('agregar refacciones', () => {
  test('test_agregar_crea_la_linea_con_el_precio_vigente_y_una_salida_ligada_a_la_orden', async () => {
    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.parts[0]).toEqual(
      expect.objectContaining({ partId: pieza.id, quantity: 3, unitPrice: 120, amount: 360 })
    );
    expect(await existencia(pieza.id)).toBe(7);
    expect(await movimientosDe(pieza.id)).toEqual([
      expect.objectContaining({ type: 'IN', quantity: 10 }),
      expect.objectContaining({ type: 'OUT', quantity: -3, order_id: orden.id, reason: `Uso en la orden ${orden.folio}` })
    ]);
    await expectInvariante();
  });

  test('test_agregar_la_misma_refaccion_suma_a_la_linea_existente_conservando_el_precio', async () => {
    await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 2 });
    await pool.query('UPDATE parts SET price = 200 WHERE id = ?', [pieza.id]);

    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 3 });

    expect(res.body.data.parts).toHaveLength(1);
    expect(res.body.data.parts[0]).toEqual(
      expect.objectContaining({ quantity: 5, unitPrice: 120, amount: 600 })
    );
    expect(await existencia(pieza.id)).toBe(5);
    await expectInvariante();
  });

  test('test_el_total_de_la_orden_incluye_las_refacciones_en_detalle_y_listado', async () => {
    await createOrderService(orden.id, { amount: 500 });
    await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 2 });

    const res = await detalle(mecanico.auth, orden.id);
    const listado = await request(app).get('/api/orders').set('Authorization', mecanico.auth);

    expect(res.body.data).toEqual(
      expect.objectContaining({ servicesSubtotal: 500, laborSubtotal: 0, partsSubtotal: 240, total: 740 })
    );
    expect(listado.body.data[0].total).toBe(740);
  });

  test('test_cambiar_el_precio_del_catalogo_no_altera_las_lineas_existentes', async () => {
    await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 1 });

    await pool.query('UPDATE parts SET price = 999 WHERE id = ?', [pieza.id]);
    const res = await detalle(mecanico.auth, orden.id);

    expect(res.body.data.parts[0].unitPrice).toBe(120);
    expect(res.body.data.partsSubtotal).toBe(120);
  });

  test('test_agregar_toda_la_existencia_deja_la_refaccion_agotada', async () => {
    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 10 });

    expect(res.status).toBe(200);
    expect(await existencia(pieza.id)).toBe(0);
  });

  test.each(ESTADOS_DE_TRABAJO)('test_se_puede_agregar_en_el_estado_%s', async (estado) => {
    const otra = await createOrder({ mechanicId: mecanico.user.id, status: estado });

    const res = await agregar(mecanico.auth, otra.id, { partId: pieza.id, quantity: 1 });

    expect(res.status).toBe(200);
  });
});

describe('rechazos al agregar', () => {
  test('test_una_cantidad_mayor_a_la_existencia_se_rechaza_sin_cambios', async () => {
    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 11 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details).toEqual({ partId: pieza.id, available: 10, requested: 11 });
    expect(await existencia(pieza.id)).toBe(10);
    expect(await movimientosDe(pieza.id)).toHaveLength(1);
    expect((await detalle(mecanico.auth, orden.id)).body.data.parts).toEqual([]);
  });

  test('test_sumar_a_una_linea_existente_mas_de_la_existencia_restante_se_rechaza', async () => {
    await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 8 });

    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error.details.available).toBe(2);
    expect((await detalle(mecanico.auth, orden.id)).body.data.parts[0].quantity).toBe(8);
  });

  test.each([
    ['cero', 0],
    ['negativa', -1],
    ['no entera', 1.5],
    ['en texto', '2']
  ])('test_rechaza_una_cantidad_%s', async (_nombre, quantity) => {
    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('quantity');
    expect(await existencia(pieza.id)).toBe(10);
  });

  test('test_una_refaccion_inactiva_se_rechaza', async () => {
    await pool.query('UPDATE parts SET active = 0 WHERE id = ?', [pieza.id]);

    const res = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PART_INACTIVE');
    expect(await existencia(pieza.id)).toBe(10);
  });

  test('test_una_refaccion_inexistente_responde_404', async () => {
    const res = await agregar(mecanico.auth, orden.id, { partId: 9999, quantity: 1 });

    expect(res.status).toBe(404);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_la_orden_en_%s_no_admite_refacciones', async (estado) => {
    const cerrada = await createOrder({ mechanicId: mecanico.user.id, status: estado });

    const res = await agregar(mecanico.auth, cerrada.id, { partId: pieza.id, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    expect(await existencia(pieza.id)).toBe(10);
  });
});

describe('cambiar la cantidad y quitar', () => {
  test('test_aumentar_la_cantidad_genera_una_salida_por_la_diferencia', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 2 });
    const lineaId = creada.body.data.parts[0].id;

    const res = await cambiar(mecanico.auth, orden.id, lineaId, { quantity: 6 });

    expect(res.status).toBe(200);
    expect(res.body.data.parts[0].quantity).toBe(6);
    expect(await existencia(pieza.id)).toBe(4);
    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos[movimientos.length - 1]).toEqual(
      expect.objectContaining({ type: 'OUT', quantity: -4, order_id: orden.id })
    );
    await expectInvariante();
  });

  test('test_reducir_la_cantidad_devuelve_la_diferencia_con_una_entrada_ligada_a_la_orden', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 6 });
    const lineaId = creada.body.data.parts[0].id;

    const res = await cambiar(mecanico.auth, orden.id, lineaId, { quantity: 2 });

    expect(res.body.data.parts[0].quantity).toBe(2);
    expect(await existencia(pieza.id)).toBe(8);
    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos[movimientos.length - 1]).toEqual(
      expect.objectContaining({
        type: 'IN',
        quantity: 4,
        order_id: orden.id,
        reason: `Devolución de la orden ${orden.folio}`
      })
    );
    await expectInvariante();
  });

  test('test_dejar_la_misma_cantidad_no_genera_movimientos', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 2 });
    const lineaId = creada.body.data.parts[0].id;

    const res = await cambiar(mecanico.auth, orden.id, lineaId, { quantity: 2 });

    expect(res.status).toBe(200);
    expect(await movimientosDe(pieza.id)).toHaveLength(2);
  });

  test('test_aumentar_mas_alla_de_la_existencia_se_rechaza_sin_cambios', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 2 });
    const lineaId = creada.body.data.parts[0].id;

    const res = await cambiar(mecanico.auth, orden.id, lineaId, { quantity: 20 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details.available).toBe(8);
    expect(await existencia(pieza.id)).toBe(8);
  });

  test('test_quitar_devuelve_toda_la_cantidad_y_elimina_la_linea', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 4 });
    const lineaId = creada.body.data.parts[0].id;

    const res = await quitar(mecanico.auth, orden.id, lineaId);

    expect(res.status).toBe(200);
    expect(res.body.data.parts).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(await existencia(pieza.id)).toBe(10);
    const movimientos = await movimientosDe(pieza.id);
    expect(movimientos[movimientos.length - 1]).toEqual(
      expect.objectContaining({ type: 'IN', quantity: 4, order_id: orden.id })
    );
    await expectInvariante();
  });

  test('test_cambiar_o_quitar_una_linea_inexistente_o_de_otra_orden_responde_404', async () => {
    const otra = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });
    const lineaAjena = await createOrderPart(otra.id, pieza.id, { quantity: 1 });

    expect((await cambiar(mecanico.auth, orden.id, 9999, { quantity: 1 })).status).toBe(404);
    expect((await cambiar(mecanico.auth, orden.id, lineaAjena.id, { quantity: 1 })).status).toBe(404);
    expect((await quitar(mecanico.auth, orden.id, lineaAjena.id)).status).toBe(404);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_no_se_cambian_ni_quitan_lineas_en_%s', async (estado) => {
    const cerrada = await createOrder({ mechanicId: mecanico.user.id, status: estado });
    const linea = await createOrderPart(cerrada.id, pieza.id, { quantity: 2 });

    const cambio = await cambiar(mecanico.auth, cerrada.id, linea.id, { quantity: 1 });
    const baja = await quitar(mecanico.auth, cerrada.id, linea.id);

    expect(cambio.status).toBe(409);
    expect(baja.status).toBe(409);
    expect(cambio.body.error.code).toBe('ORDER_NOT_EDITABLE');
  });

  test('test_cambiar_la_cantidad_a_cero_se_rechaza', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 2 });

    const res = await cambiar(mecanico.auth, orden.id, creada.body.data.parts[0].id, { quantity: 0 });

    expect(res.status).toBe(400);
  });

  test('test_aumentar_una_linea_de_una_refaccion_dada_de_baja_se_rechaza_pero_reducir_o_quitar_se_permite', async () => {
    const creada = await agregar(mecanico.auth, orden.id, { partId: pieza.id, quantity: 4 });
    const lineaId = creada.body.data.parts[0].id;
    await pool.query('UPDATE parts SET active = 0 WHERE id = ?', [pieza.id]);

    const aumento = await cambiar(mecanico.auth, orden.id, lineaId, { quantity: 5 });
    const reduccion = await cambiar(mecanico.auth, orden.id, lineaId, { quantity: 3 });
    const baja = await quitar(mecanico.auth, orden.id, lineaId);

    expect(aumento.status).toBe(409);
    expect(aumento.body.error.code).toBe('PART_INACTIVE');
    expect(reduccion.status).toBe(200);
    expect(baja.status).toBe(200);
    await expectInvariante();
  });
});

describe('permisos sobre las refacciones de la orden', () => {
  test('test_el_mecanico_de_otra_orden_recibe_404_y_no_se_modifica_el_inventario', async () => {
    const otro = await createAuthenticated('MECHANIC');

    const res = await agregar(otro.auth, orden.id, { partId: pieza.id, quantity: 1 });

    expect(res.status).toBe(404);
    expect(await existencia(pieza.id)).toBe(10);
  });

  test('test_la_recepcion_no_puede_modificar_pero_si_ver_las_refacciones', async () => {
    const recepcion = await createAuthenticated('RECEPTIONIST');
    const linea = await createOrderPart(orden.id, pieza.id, { quantity: 1 });

    const alta = await agregar(recepcion.auth, orden.id, { partId: pieza.id, quantity: 1 });
    const cambio = await cambiar(recepcion.auth, orden.id, linea.id, { quantity: 2 });
    const baja = await quitar(recepcion.auth, orden.id, linea.id);
    const vista = await detalle(recepcion.auth, orden.id);

    expect([alta.status, cambio.status, baja.status]).toEqual([403, 403, 403]);
    expect(vista.status).toBe(200);
    expect(vista.body.data.parts).toHaveLength(1);
    expect(vista.body.data.editable.parts).toBe(false);
  });

  test('test_el_administrador_puede_modificar_las_refacciones_de_cualquier_orden', async () => {
    const admin = await createAuthenticated('ADMIN');

    const res = await agregar(admin.auth, orden.id, { partId: pieza.id, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.editable.parts).toBe(true);
  });

  test('test_sin_token_responde_401', async () => {
    const res = await request(app).post(`/api/orders/${orden.id}/parts`).send({ partId: pieza.id, quantity: 1 });

    expect(res.status).toBe(401);
  });

  test('test_editable_parts_es_falso_en_las_ordenes_cerradas', async () => {
    const cerrada = await createOrder({ mechanicId: mecanico.user.id, status: 'TERMINADO' });

    const res = await detalle(mecanico.auth, cerrada.id);

    expect(res.body.data.editable.parts).toBe(false);
  });
});
