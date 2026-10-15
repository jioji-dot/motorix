// Pruebas de integración del cobro con Mercado Pago (US3) contra `motorix_test` y el servidor simulado.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createOrderService, createPayment } from '../helpers/factories.js';
import * as stub from '../helpers/mercadoPagoStub.js';

const app = createApp();

const cobrar = (auth, orderId, cuerpo = {}) =>
  request(app).post(`/api/orders/${orderId}/payments/mercado-pago`).set('Authorization', auth).send(cuerpo);
const actualizar = (auth, id) => request(app).post(`/api/payments/${id}/refresh`).set('Authorization', auth);
const cancelar = (auth, id) => request(app).post(`/api/payments/${id}/cancel`).set('Authorization', auth);
const efectivo = (auth, orderId, amount) =>
  request(app).post(`/api/orders/${orderId}/payments`).set('Authorization', auth).send({ method: 'CASH', amount });
const resumenDe = async (auth, orderId) =>
  (await request(app).get(`/api/orders/${orderId}/payments`).set('Authorization', auth)).body.data.summary;
const contarPagos = async () => (await pool.query('SELECT COUNT(*) AS n FROM payments'))[0][0].n;

let recepcion;
let admin;
let mecanico;
let orden;

beforeAll(stub.start);
afterAll(async () => {
  await stub.stop();
  await closePool();
});

beforeEach(async () => {
  stub.reset();
  process.env.MP_ACCESS_TOKEN = stub.STUB_TOKEN;
  process.env.MP_TIMEOUT_MS = '10000';
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  admin = await createAuthenticated('ADMIN');
  mecanico = await createAuthenticated('MECHANIC');
  orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});

describe('alta del cobro', () => {
  test('test_crea_un_pago_pendiente_con_referencia_enlace_y_el_saldo_disponible', async () => {
    const res = await cobrar(recepcion.auth, orden.id);

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'MERCADO_PAGO',
        status: 'PENDIENTE',
        amount: 1000,
        paymentUrl: expect.stringContaining('https://sandbox.mp.test/checkout/'),
        canCancel: true,
        canRefresh: true
      })
    );
    expect(res.body.data.payment.externalReference).toMatch(new RegExp(`^MTX-${orden.folio}-[0-9A-F]{8}$`));
    expect(stub.requests[0].body.items[0]).toEqual(expect.objectContaining({ unit_price: 1000, currency_id: 'MXN' }));
    expect(stub.requests[0].body.external_reference).toBe(res.body.data.payment.externalReference);
  });

  test('test_el_importe_indicado_menor_al_saldo_se_respeta', async () => {
    const res = await cobrar(recepcion.auth, orden.id, { amount: 400 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.amount).toBe(400);
    expect(stub.requests[0].body.items[0].unit_price).toBe(400);
  });

  test('test_el_cobro_reserva_saldo_sin_cambiar_lo_pagado', async () => {
    const res = await cobrar(recepcion.auth, orden.id, { amount: 300 });

    expect(res.body.data.summary).toEqual({
      total: 1000,
      paid: 0,
      pending: 300,
      balance: 1000,
      available: 700,
      status: 'UNPAID'
    });
  });

  test('test_un_importe_mayor_al_disponible_responde_409', async () => {
    await efectivo(recepcion.auth, orden.id, 800);

    const res = await cobrar(recepcion.auth, orden.id, { amount: 250 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(stub.requests).toHaveLength(0);
  });

  test('test_un_segundo_cobro_con_uno_pendiente_responde_409_con_el_pendiente_en_details', async () => {
    const primero = await cobrar(recepcion.auth, orden.id, { amount: 300 });

    const res = await cobrar(recepcion.auth, orden.id, { amount: 100 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_PENDING_EXISTS');
    expect(res.body.error.details.pending).toEqual(
      expect.objectContaining({ id: primero.body.data.payment.id, amount: 300 })
    );
    expect(await contarPagos()).toBe(1);
  });

  test('test_un_pago_manual_que_supera_el_saldo_disponible_por_la_reserva_responde_409', async () => {
    await cobrar(recepcion.auth, orden.id, { amount: 700 });

    const res = await efectivo(recepcion.auth, orden.id, 400);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect((await efectivo(recepcion.auth, orden.id, 300)).status).toBe(201);
  });

  test('test_una_orden_que_no_esta_terminada_no_se_cobra', async () => {
    const abierta = await createOrder({ status: 'EN_REPARACION' });
    await createOrderService(abierta.id, { amount: 500 });

    const res = await cobrar(recepcion.auth, abierta.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_ORDER_NOT_PAYABLE');
  });

  test('test_una_orden_inexistente_responde_404', async () => {
    expect((await cobrar(recepcion.auth, 999999)).status).toBe(404);
  });
});

describe('actualización del estado', () => {
  const crearCobro = async (monto = 1000) => {
    const res = await cobrar(recepcion.auth, orden.id, { amount: monto });
    return res.body.data.payment;
  };

  test('test_aprobado_en_mercado_pago_deja_el_pago_aprobado_y_baja_el_saldo', async () => {
    const pago = await crearCobro(600);
    stub.setPayments(pago.externalReference, [{ id: 555, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);

    const res = await actualizar(recepcion.auth, pago.id);

    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual(expect.objectContaining({ status: 'APROBADO', canRefresh: false, canCancel: false }));
    expect(res.body.data.summary).toEqual(expect.objectContaining({ paid: 600, pending: 0, balance: 400, status: 'PARTIAL' }));
  });

  test('test_repetir_la_actualizacion_no_cambia_nada', async () => {
    const pago = await crearCobro(600);
    stub.setPayments(pago.externalReference, [{ id: 555, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);
    await actualizar(recepcion.auth, pago.id);

    const segunda = await actualizar(recepcion.auth, pago.id);

    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('PAYMENT_INVALID_STATE');
    expect(await resumenDe(recepcion.auth, orden.id)).toEqual(expect.objectContaining({ paid: 600 }));
  });

  test('test_dos_actualizaciones_simultaneas_aprueban_una_sola_vez', async () => {
    const pago = await crearCobro(600);
    stub.setPayments(pago.externalReference, [{ id: 555, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);

    const respuestas = await Promise.all([actualizar(recepcion.auth, pago.id), actualizar(admin.auth, pago.id)]);

    expect(respuestas.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(await resumenDe(recepcion.auth, orden.id)).toEqual(expect.objectContaining({ paid: 600, pending: 0 }));
  });

  test.each(['rejected', 'cancelled'])('test_%s_en_mercado_pago_deja_el_pago_rechazado_y_libera_la_reserva', async (estado) => {
    const pago = await crearCobro(600);
    stub.setPayments(pago.externalReference, [{ id: 9, status: estado, date_created: '2026-10-14T10:00:00.000-06:00' }]);

    const res = await actualizar(recepcion.auth, pago.id);

    expect(res.body.data.payment.status).toBe('RECHAZADO');
    expect(res.body.data.summary).toEqual(expect.objectContaining({ paid: 0, pending: 0, available: 1000 }));
  });

  test.each(['pending', 'in_process', 'authorized'])('test_%s_en_mercado_pago_sigue_pendiente', async (estado) => {
    const pago = await crearCobro(600);
    stub.setPayments(pago.externalReference, [{ id: 9, status: estado, date_created: '2026-10-14T10:00:00.000-06:00' }]);

    const res = await actualizar(recepcion.auth, pago.id);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('PENDIENTE');
    expect(res.body.data.summary.pending).toBe(600);
  });

  test('test_sin_resultados_en_mercado_pago_sigue_pendiente', async () => {
    const pago = await crearCobro(600);

    const res = await actualizar(recepcion.auth, pago.id);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('PENDIENTE');
  });

  test('test_actualizar_un_pago_manual_o_cerrado_responde_409', async () => {
    const manual = (await efectivo(recepcion.auth, orden.id, 100)).body.data.payment;
    const pago = await crearCobro(300);
    await cancelar(recepcion.auth, pago.id);

    const a = await actualizar(recepcion.auth, manual.id);
    const b = await actualizar(recepcion.auth, pago.id);

    expect(a.status).toBe(409);
    expect(a.body.error.code).toBe('PAYMENT_INVALID_STATE');
    expect(b.status).toBe(409);
  });

  test('test_actualizar_un_pago_inexistente_responde_404', async () => {
    expect((await actualizar(recepcion.auth, 999999)).status).toBe(404);
  });
});

describe('cancelación, anulación y control de aprobación', () => {
  test('test_cancelar_un_cobro_pendiente_libera_la_reserva', async () => {
    const pago = (await cobrar(recepcion.auth, orden.id, { amount: 600 })).body.data.payment;

    const res = await cancelar(recepcion.auth, pago.id);

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('CANCELADO');
    expect(res.body.data.summary).toEqual(expect.objectContaining({ pending: 0, available: 1000 }));
    expect((await cobrar(recepcion.auth, orden.id)).status).toBe(201);
  });

  test('test_no_existe_forma_de_aprobar_un_cobro_a_mano', async () => {
    const pago = (await cobrar(recepcion.auth, orden.id, { amount: 600 })).body.data.payment;

    const intentos = await Promise.all([
      request(app).patch(`/api/payments/${pago.id}`).set('Authorization', admin.auth).send({ status: 'APROBADO' }),
      request(app).put(`/api/payments/${pago.id}`).set('Authorization', admin.auth).send({ status: 'APROBADO' }),
      request(app).post(`/api/payments/${pago.id}/approve`).set('Authorization', admin.auth).send({})
    ]);

    for (const r of intentos) expect(r.status).toBe(404);
    expect((await resumenDe(admin.auth, orden.id)).paid).toBe(0);
  });

  test('test_anular_un_cobro_aprobado_recupera_el_saldo', async () => {
    const pago = (await cobrar(recepcion.auth, orden.id, { amount: 600 })).body.data.payment;
    stub.setPayments(pago.externalReference, [{ id: 555, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);
    await actualizar(recepcion.auth, pago.id);

    const res = await request(app)
      .post(`/api/payments/${pago.id}/void`)
      .set('Authorization', admin.auth)
      .send({ reason: 'Devolución al cliente' });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('ANULADO');
    expect(res.body.data.summary).toEqual(expect.objectContaining({ paid: 0, balance: 1000, status: 'UNPAID' }));
  });
});

describe('proveedor no disponible', () => {
  test('test_sin_token_responde_503_y_no_registra_ningun_pago', async () => {
    delete process.env.MP_ACCESS_TOKEN;

    const res = await cobrar(recepcion.auth, orden.id);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(await contarPagos()).toBe(0);
  });

  test.each(['error500', 'invalidJson'])('test_con_mercado_pago_en_%s_responde_503_sin_registrar_nada', async (modo) => {
    stub.setFailure(modo);

    const res = await cobrar(recepcion.auth, orden.id);

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(await contarPagos()).toBe(0);
    expect((await resumenDe(recepcion.auth, orden.id)).pending).toBe(0);
  });

  test('test_el_tiempo_de_espera_agotado_responde_503_sin_registrar_nada', async () => {
    stub.setFailure('slow');
    process.env.MP_TIMEOUT_MS = '200';

    const res = await cobrar(recepcion.auth, orden.id);

    expect(res.status).toBe(503);
    expect(await contarPagos()).toBe(0);
  });

  test('test_actualizar_con_mercado_pago_caido_responde_503_y_conserva_el_pendiente', async () => {
    const pago = (await cobrar(recepcion.auth, orden.id, { amount: 600 })).body.data.payment;
    stub.setFailure('error500');

    const res = await actualizar(recepcion.auth, pago.id);

    expect(res.status).toBe(503);
    expect((await resumenDe(recepcion.auth, orden.id)).pending).toBe(600);
  });
});

describe('datos sensibles y permisos', () => {
  test('test_ninguna_respuesta_ni_columna_contiene_el_token_ni_datos_de_tarjeta', async () => {
    const creado = await cobrar(recepcion.auth, orden.id, { amount: 600 });
    const pago = creado.body.data.payment;
    stub.setPayments(pago.externalReference, [{ id: 555, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);
    const actualizado = await actualizar(recepcion.auth, pago.id);
    const listado = await request(app).get('/api/payments').set('Authorization', admin.auth);

    for (const r of [creado, actualizado, listado]) {
      const texto = JSON.stringify(r.body);
      expect(texto).not.toContain(stub.STUB_TOKEN);
      expect(texto.toLowerCase()).not.toMatch(/cardnumber|cvv|expiry/);
    }

    const [filas] = await pool.query('SELECT * FROM payments');
    expect(JSON.stringify(filas)).not.toContain(stub.STUB_TOKEN);
    const [columnas] = await pool.query(
      "SELECT COLUMN_NAME AS nombre FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'"
    );
    expect(columnas.map((c) => c.nombre.toLowerCase()).filter((n) => /card|cvv|expiry|token/.test(n))).toEqual([]);
  });

  test('test_recepcion_y_administracion_pueden_y_el_mecanico_no', async () => {
    const a = await cobrar(recepcion.auth, orden.id, { amount: 100 });
    await cancelar(recepcion.auth, a.body.data.payment.id);
    const b = await cobrar(admin.auth, orden.id, { amount: 100 });
    const c = await cobrar(mecanico.auth, orden.id, { amount: 100 });
    const d = await actualizar(mecanico.auth, b.body.data.payment.id);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(c.status).toBe(403);
    expect(d.status).toBe(403);
  });

  test('test_rechaza_importes_invalidos_y_campos_desconocidos', async () => {
    const cero = await cobrar(recepcion.auth, orden.id, { amount: 0 });
    const decimales = await cobrar(recepcion.auth, orden.id, { amount: 10.123 });
    const extra = await cobrar(recepcion.auth, orden.id, { amount: 10, cardNumber: '4111111111111111' });

    expect([cero.status, decimales.status, extra.status]).toEqual([400, 400, 400]);
    expect(await contarPagos()).toBe(0);
  });

  test('test_un_cobro_pendiente_sembrado_directo_tambien_se_actualiza', async () => {
    const pago = await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 250, status: 'PENDIENTE' });
    stub.setPayments(pago.externalReference, [{ id: 7, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);

    const res = await actualizar(recepcion.auth, pago.id);

    expect(res.body.data.payment.status).toBe('APROBADO');
  });
});
