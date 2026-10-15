// Pruebas de integración del registro y la gestión de pagos (US1) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createOrder,
  createOrderLabor,
  createOrderPart,
  createOrderService,
  createPart,
  createPayment,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const pagar = (auth, orderId, cuerpo) =>
  request(app).post(`/api/orders/${orderId}/payments`).set('Authorization', auth).send(cuerpo);
const efectivo = (auth, orderId, amount) => pagar(auth, orderId, { method: 'CASH', amount });
const resumenDe = async (auth, orderId) =>
  (await request(app).get(`/api/orders/${orderId}/payments`).set('Authorization', auth)).body.data.summary;

let recepcion;
let admin;
let orden;

beforeEach(async () => {
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  admin = await createAuthenticated('ADMIN');
  orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});
afterAll(closePool);

describe('registro de pagos', () => {
  test('test_un_pago_por_el_total_deja_la_orden_pagada_con_saldo_cero', async () => {
    const res = await efectivo(recepcion.auth, orden.id, 1000);

    expect(res.status).toBe(201);
    expect(res.body.data.summary).toEqual({
      total: 1000,
      paid: 1000,
      pending: 0,
      balance: 0,
      available: 0,
      status: 'PAID'
    });
  });

  test('test_los_abonos_llevan_la_orden_de_sin_pagar_a_parcial_y_a_pagada', async () => {
    expect((await resumenDe(recepcion.auth, orden.id)).status).toBe('UNPAID');

    await efectivo(recepcion.auth, orden.id, 300);
    expect(await resumenDe(recepcion.auth, orden.id)).toEqual(
      expect.objectContaining({ status: 'PARTIAL', paid: 300, balance: 700 })
    );

    await efectivo(recepcion.auth, orden.id, 699.99);
    expect(await resumenDe(recepcion.auth, orden.id)).toEqual(
      expect.objectContaining({ status: 'PARTIAL', paid: 999.99, balance: 0.01 })
    );

    await efectivo(recepcion.auth, orden.id, 0.01);
    expect(await resumenDe(recepcion.auth, orden.id)).toEqual(
      expect.objectContaining({ status: 'PAID', paid: 1000, balance: 0 })
    );
  });

  test('test_el_pago_guarda_orden_usuario_fecha_e_importe_exacto', async () => {
    const res = await efectivo(recepcion.auth, orden.id, 123.45);

    const [[fila]] = await pool.query('SELECT order_id, amount, created_by, created_at FROM payments WHERE id = ?', [
      res.body.data.payment.id
    ]);
    expect(fila.order_id).toBe(orden.id);
    expect(Number(fila.amount)).toBe(123.45);
    expect(fila.created_by).toBe(recepcion.user.id);
    expect(fila.created_at).toBeInstanceOf(Date);
  });

  test('test_el_total_incluye_servicios_mano_de_obra_y_refacciones', async () => {
    await createOrderLabor(orden.id, { hours: 2, hourlyRate: 300 });
    const pieza = await createPart();
    await createOrderPart(orden.id, pieza.id, { quantity: 2, unitPrice: 99.99 });

    const resumen = await resumenDe(recepcion.auth, orden.id);

    expect(resumen.total).toBe(1000 + 600 + 199.98);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_se_puede_cobrar_una_orden_%s', async (estado) => {
    const otra = await createOrder({ status: estado });
    await createOrderService(otra.id, { amount: 100 });

    const res = await efectivo(recepcion.auth, otra.id, 100);

    expect(res.status).toBe(201);
  });

  test.each(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'])(
    'test_no_se_cobra_una_orden_%s',
    async (estado) => {
      const enProceso = await createOrder({ status: estado });
      await createOrderService(enProceso.id, { amount: 100 });

      const res = await efectivo(recepcion.auth, enProceso.id, 50);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_ORDER_NOT_PAYABLE');
      expect(res.body.error.details.status).toBe(estado);
      const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments');
      expect(total).toBe(0);
    }
  );

  test('test_no_se_cobra_una_orden_con_total_cero', async () => {
    const sinTotal = await createOrder({ status: 'ENTREGADO' });

    const res = await efectivo(recepcion.auth, sinTotal.id, 10);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_ORDER_NOT_PAYABLE');
    expect(res.body.error.details.total).toBe(0);
  });

  test('test_una_orden_pagada_por_completo_no_admite_otro_pago', async () => {
    await efectivo(recepcion.auth, orden.id, 1000);

    const res = await efectivo(recepcion.auth, orden.id, 0.01);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(res.body.error.details.available).toBe(0);
  });

  test('test_una_orden_inexistente_responde_404', async () => {
    const res = await efectivo(recepcion.auth, 9999, 10);

    expect(res.status).toBe(404);
  });
});

describe('validación del importe', () => {
  test('test_un_importe_mayor_al_saldo_se_rechaza_con_el_saldo_disponible_y_sin_cambios', async () => {
    await efectivo(recepcion.auth, orden.id, 400);

    const res = await efectivo(recepcion.auth, orden.id, 600.01);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(res.body.error.details).toEqual({ available: 600, requested: 600.01 });
    expect((await resumenDe(recepcion.auth, orden.id)).paid).toBe(400);
  });

  test.each([
    ['cero', 0],
    ['negativo', -10],
    ['con tres decimales', 10.123],
    ['en texto', '10'],
    ['demasiado grande', 1e12]
  ])('test_rechaza_un_importe_%s', async (_nombre, amount) => {
    const res = await efectivo(recepcion.auth, orden.id, amount);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('amount');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments');
    expect(total).toBe(0);
  });

  test('test_el_importe_con_centavos_se_conserva_sin_redondeos', async () => {
    const otra = await createOrder({ status: 'TERMINADO' });
    await createOrderService(otra.id, { amount: 33.33 });
    await createOrderService(otra.id, { amount: 66.67 });

    await efectivo(recepcion.auth, otra.id, 33.33);
    await efectivo(recepcion.auth, otra.id, 66.67);

    expect(await resumenDe(recepcion.auth, otra.id)).toEqual(expect.objectContaining({ paid: 100, status: 'PAID' }));
  });
});

describe('cancelar y anular', () => {
  test('test_cancelar_un_pago_pendiente_lo_deja_cancelado_y_libera_el_importe_reservado', async () => {
    const pago = await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 600 });
    expect((await resumenDe(recepcion.auth, orden.id)).available).toBe(400);

    const res = await request(app).post(`/api/payments/${pago.id}/cancel`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('CANCELADO');
    expect(res.body.data.summary).toEqual(expect.objectContaining({ pending: 0, available: 1000 }));
  });

  test.each(['APROBADO', 'RECHAZADO', 'CANCELADO', 'ANULADO'])('test_no_se_cancela_un_pago_%s', async (estado) => {
    const pago = await createPayment(orden.id, {
      method: estado === 'RECHAZADO' ? 'MERCADO_PAGO' : 'CASH',
      amount: 100,
      status: estado
    });

    const res = await request(app).post(`/api/payments/${pago.id}/cancel`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_INVALID_STATE');
  });

  test('test_el_administrador_anula_un_pago_aprobado_con_motivo_y_se_recupera_el_saldo', async () => {
    const pago = (await efectivo(recepcion.auth, orden.id, 1000)).body.data.payment;
    expect((await resumenDe(admin.auth, orden.id)).status).toBe('PAID');

    const res = await request(app)
      .post(`/api/payments/${pago.id}/void`)
      .set('Authorization', admin.auth)
      .send({ reason: '  Cobro duplicado  ' });

    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual(
      expect.objectContaining({ status: 'ANULADO', voidReason: 'Cobro duplicado', voidedByName: admin.user.name })
    );
    expect(res.body.data.summary).toEqual(
      expect.objectContaining({ paid: 0, balance: 1000, available: 1000, status: 'UNPAID' })
    );
    const [[fila]] = await pool.query('SELECT voided_by, voided_at FROM payments WHERE id = ?', [pago.id]);
    expect(fila.voided_by).toBe(admin.user.id);
    expect(fila.voided_at).not.toBeNull();
  });

  test('test_despues_de_anular_se_puede_volver_a_cobrar_el_saldo_recuperado', async () => {
    const pago = (await efectivo(recepcion.auth, orden.id, 1000)).body.data.payment;
    await request(app).post(`/api/payments/${pago.id}/void`).set('Authorization', admin.auth).send({ reason: 'Error' });

    const res = await efectivo(recepcion.auth, orden.id, 1000);

    expect(res.status).toBe(201);
    expect(res.body.data.summary.status).toBe('PAID');
  });

  test('test_la_recepcion_no_puede_anular', async () => {
    const pago = (await efectivo(recepcion.auth, orden.id, 100)).body.data.payment;

    const res = await request(app)
      .post(`/api/payments/${pago.id}/void`)
      .set('Authorization', recepcion.auth)
      .send({ reason: 'Intento' });

    expect(res.status).toBe(403);
    expect((await resumenDe(admin.auth, orden.id)).paid).toBe(100);
  });

  test.each([
    ['sin motivo', {}],
    ['con motivo vacío', { reason: '   ' }],
    ['con motivo demasiado largo', { reason: 'x'.repeat(256) }]
  ])('test_anular_%s_se_rechaza', async (_nombre, cuerpo) => {
    const pago = await createPayment(orden.id, { amount: 100 });

    const res = await request(app).post(`/api/payments/${pago.id}/void`).set('Authorization', admin.auth).send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('reason');
  });

  test.each(['PENDIENTE', 'RECHAZADO', 'CANCELADO', 'ANULADO'])('test_no_se_anula_un_pago_%s', async (estado) => {
    const pago = await createPayment(orden.id, {
      method: estado === 'ANULADO' || estado === 'CANCELADO' ? 'CASH' : 'MERCADO_PAGO',
      amount: 100,
      status: estado
    });

    const res = await request(app)
      .post(`/api/payments/${pago.id}/void`)
      .set('Authorization', admin.auth)
      .send({ reason: 'Intento' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_INVALID_STATE');
  });

  test('test_los_pagos_nunca_se_eliminan', async () => {
    const pago = await createPayment(orden.id, { amount: 100 });

    const res = await request(app).delete(`/api/payments/${pago.id}`).set('Authorization', admin.auth);

    expect([404, 405]).toContain(res.status);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments');
    expect(total).toBe(1);
  });

  test('test_un_pago_inexistente_responde_404_al_cancelar_y_al_anular', async () => {
    const cancelar = await request(app).post('/api/payments/9999/cancel').set('Authorization', recepcion.auth);
    const anular = await request(app)
      .post('/api/payments/9999/void')
      .set('Authorization', admin.auth)
      .send({ reason: 'x' });

    expect(cancelar.status).toBe(404);
    expect(anular.status).toBe(404);
  });
});

describe('listado y consulta de pagos', () => {
  let otra;

  beforeEach(async () => {
    const cliente = await createClient({ name: 'Luis Gómez' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'XYZ789' });
    otra = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, status: 'ENTREGADO' });
    await createOrderService(otra.id, { amount: 500 });
  });

  const listar = (consulta = '') =>
    request(app).get(`/api/payments${consulta}`).set('Authorization', recepcion.auth);

  test('test_lista_del_mas_reciente_al_mas_antiguo_con_paginacion', async () => {
    const a = await createPayment(orden.id, { amount: 100 });
    const b = await createPayment(orden.id, { amount: 200 });
    const c = await createPayment(otra.id, { amount: 300 });

    const res = await listar('?page=1&pageSize=2');

    expect(res.body.data.map((p) => p.id)).toEqual([c.id, b.id]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, approvedTotal: 600 });
    expect((await listar('?page=2&pageSize=2')).body.data.map((p) => p.id)).toEqual([a.id]);
  });

  test('test_filtra_por_estado_y_por_metodo', async () => {
    await createPayment(orden.id, { amount: 100, method: 'CASH' });
    await createPayment(orden.id, { amount: 100, method: 'CARD' });
    await createPayment(orden.id, { amount: 100, method: 'MERCADO_PAGO' });
    await createPayment(orden.id, { amount: 100, status: 'ANULADO' });

    expect((await listar('?method=CARD')).body.data).toHaveLength(1);
    expect((await listar('?status=PENDIENTE')).body.data.map((p) => p.method)).toEqual(['MERCADO_PAGO']);
    expect((await listar('?status=ANULADO')).body.meta.total).toBe(1);
    expect((await listar('?status=APROBADO&method=CASH')).body.meta.total).toBe(1);
  });

  test('test_el_total_aprobado_solo_suma_los_aprobados_del_filtro', async () => {
    await createPayment(orden.id, { amount: 100 });
    await createPayment(orden.id, { amount: 250.5, method: 'CARD' });
    await createPayment(orden.id, { amount: 999, status: 'ANULADO' });
    await createPayment(orden.id, { amount: 999, status: 'CANCELADO' });

    expect((await listar()).body.meta.approvedTotal).toBe(350.5);
    expect((await listar('?method=CARD')).body.meta.approvedTotal).toBe(250.5);
  });

  test('test_filtra_por_rango_de_fechas_del_pago', async () => {
    const vieja = await createPayment(orden.id, { amount: 100 });
    await createPayment(orden.id, { amount: 100 });
    await pool.query("UPDATE payments SET created_at = '2026-01-15 10:00:00' WHERE id = ?", [vieja.id]);

    expect((await listar('?from=2026-01-01&to=2026-01-31')).body.data.map((p) => p.id)).toEqual([vieja.id]);
    expect((await listar('?from=2026-02-01')).body.meta.total).toBe(1);
    expect((await listar('?to=2026-01-14')).body.meta.total).toBe(0);
    expect((await listar('?from=2026-13-40')).status).toBe(400);
  });

  test('test_busca_por_folio_cliente_o_placa', async () => {
    await createPayment(orden.id, { amount: 100 });
    const deLuis = await createPayment(otra.id, { amount: 100 });

    expect((await listar(`?search=${otra.folio}`)).body.data.map((p) => p.id)).toEqual([deLuis.id]);
    expect((await listar('?search=luis')).body.data.map((p) => p.id)).toEqual([deLuis.id]);
    expect((await listar('?search=xyz-789')).body.data.map((p) => p.id)).toEqual([deLuis.id]);
    expect((await listar('?search=%25')).body.data).toEqual([]);
  });

  test('test_el_detalle_incluye_cliente_placa_y_usuario', async () => {
    const pago = await createPayment(otra.id, { amount: 100 });

    const res = await request(app).get(`/api/payments/${pago.id}`).set('Authorization', admin.auth);

    expect(res.body.data).toEqual(
      expect.objectContaining({ orderFolio: otra.folio, clientName: 'Luis Gómez', vehiclePlate: 'XYZ789' })
    );
  });
});

describe('permisos', () => {
  test('test_el_mecanico_recibe_403_en_todas_las_rutas_de_pagos', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const pago = await createPayment(orden.id, { amount: 100 });

    const respuestas = await Promise.all([
      request(app).get(`/api/orders/${orden.id}/payments`).set('Authorization', mecanico.auth),
      pagar(mecanico.auth, orden.id, { method: 'CASH', amount: 10 }),
      request(app).get('/api/payments').set('Authorization', mecanico.auth),
      request(app).get(`/api/payments/${pago.id}`).set('Authorization', mecanico.auth),
      request(app).post(`/api/payments/${pago.id}/cancel`).set('Authorization', mecanico.auth),
      request(app).post(`/api/payments/${pago.id}/void`).set('Authorization', mecanico.auth).send({ reason: 'x' })
    ]);

    for (const res of respuestas) expect(res.status).toBe(403);
    expect((await resumenDe(admin.auth, orden.id)).paid).toBe(100);
  });

  test('test_sin_token_responde_401', async () => {
    const res = await request(app).get('/api/payments');

    expect(res.status).toBe(401);
  });

  test('test_recepcion_y_administracion_pueden_registrar_y_consultar', async () => {
    expect((await efectivo(recepcion.auth, orden.id, 10)).status).toBe(201);
    expect((await efectivo(admin.auth, orden.id, 10)).status).toBe(201);
    expect((await request(app).get('/api/payments').set('Authorization', recepcion.auth)).status).toBe(200);
  });
});
