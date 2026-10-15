// Pruebas de concurrencia de pagos (US1, FR-010, SC-002) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createOrderService, createPayment } from '../helpers/factories.js';

const app = createApp();

const pagar = (auth, orderId, amount) =>
  request(app).post(`/api/orders/${orderId}/payments`).set('Authorization', auth).send({ method: 'CASH', amount });

async function expectInvariante() {
  const [filas] = await pool.query(
    `SELECT o.id,
       (SELECT COALESCE(SUM(amount), 0) FROM order_services WHERE order_id = o.id)
       + (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE order_id = o.id)
       + (SELECT COALESCE(SUM(amount), 0) FROM order_parts WHERE order_id = o.id) AS total,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = o.id AND status = 'APROBADO') AS pagado,
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = o.id AND status = 'PENDIENTE') AS pendiente
     FROM service_orders o`
  );
  for (const fila of filas) {
    expect(Number(fila.pagado)).toBeLessThanOrEqual(Number(fila.total));
    expect(Number(fila.pagado) + Number(fila.pendiente)).toBeLessThanOrEqual(Number(fila.total));
  }
}

let recepcionistas;
let admin;
let orden;

beforeEach(async () => {
  await cleanTables();
  recepcionistas = [];
  for (let i = 0; i < 6; i += 1) recepcionistas.push(await createAuthenticated('RECEPTIONIST'));
  admin = await createAuthenticated('ADMIN');
  orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});
afterAll(closePool);

describe('pagos simultáneos', () => {
  test('test_dos_pagos_que_juntos_superan_el_saldo_solo_uno_se_acepta', async () => {
    const [a, b] = await Promise.all([
      pagar(recepcionistas[0].auth, orden.id, 700),
      pagar(recepcionistas[1].auth, orden.id, 700)
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const perdedora = a.status === 409 ? a : b;
    expect(perdedora.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(perdedora.body.error.details.available).toBe(300);
    const [[{ pagado }]] = await pool.query("SELECT SUM(amount) AS pagado FROM payments WHERE status = 'APROBADO'");
    expect(Number(pagado)).toBe(700);
    await expectInvariante();
  });

  test('test_el_pago_final_simultaneo_nunca_deja_la_orden_con_mas_pagado_que_su_total', async () => {
    const respuestas = await Promise.all(recepcionistas.map((r) => pagar(r.auth, orden.id, 250)));

    const aceptadas = respuestas.filter((r) => r.status === 201).length;
    const rechazadas = respuestas.filter((r) => r.status === 409).length;
    expect(aceptadas).toBe(4);
    expect(rechazadas).toBe(2);
    const [[{ pagado }]] = await pool.query("SELECT SUM(amount) AS pagado FROM payments WHERE status = 'APROBADO'");
    expect(Number(pagado)).toBe(1000);
    await expectInvariante();
  });

  test('test_pagos_simultaneos_en_ordenes_distintas_no_se_afectan', async () => {
    const otra = await createOrder({ status: 'TERMINADO' });
    await createOrderService(otra.id, { amount: 500 });

    const respuestas = await Promise.all([
      pagar(recepcionistas[0].auth, orden.id, 1000),
      pagar(recepcionistas[1].auth, otra.id, 500)
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([201, 201]);
    await expectInvariante();
  });

  test('test_un_pago_y_una_anulacion_simultaneos_mantienen_el_resumen_coherente', async () => {
    const previo = (await pagar(recepcionistas[0].auth, orden.id, 600)).body.data.payment;

    const [pago, anulacion] = await Promise.all([
      pagar(recepcionistas[1].auth, orden.id, 400),
      request(app).post(`/api/payments/${previo.id}/void`).set('Authorization', admin.auth).send({ reason: 'Error' })
    ]);

    expect(pago.status).toBe(201);
    expect(anulacion.status).toBe(200);
    const resumen = (await request(app).get(`/api/orders/${orden.id}/payments`).set('Authorization', admin.auth)).body
      .data.summary;
    expect(resumen.paid).toBe(400);
    expect(resumen.balance).toBe(600);
    await expectInvariante();
  });

  test('test_un_pago_manual_y_la_cancelacion_de_un_cobro_pendiente_simultaneos_son_coherentes', async () => {
    const pendiente = await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 800 });

    const [pago, cancelacion] = await Promise.all([
      pagar(recepcionistas[0].auth, orden.id, 500),
      request(app).post(`/api/payments/${pendiente.id}/cancel`).set('Authorization', recepcionistas[1].auth)
    ]);

    expect(cancelacion.status).toBe(200);
    // Según quién obtenga primero el candado, el pago cabe o se rechaza por la reserva; nunca se excede.
    expect([201, 409]).toContain(pago.status);
    await expectInvariante();
  });

  test('test_un_pago_se_rechaza_si_la_reserva_de_un_cobro_pendiente_no_deja_saldo', async () => {
    await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 800 });

    const res = await pagar(recepcionistas[0].auth, orden.id, 300);

    expect(res.status).toBe(409);
    expect(res.body.error.details.available).toBe(200);
    expect((await pagar(recepcionistas[0].auth, orden.id, 200)).status).toBe(201);
    await expectInvariante();
  });
});
