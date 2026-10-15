// Pruebas de contrato del resumen de pago en las órdenes
// (ver specs/004-pagos-tickets-dashboard/contracts/api.md, "Cambios a endpoints existentes").
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createOrder,
  createOrderService,
  createPayment,
  createTicket
} from '../helpers/factories.js';

const app = createApp();

beforeEach(cleanTables);
afterAll(closePool);

async function ordenCobrable(estado = 'TERMINADO', importe = 1000, extra = {}) {
  const orden = await createOrder({ status: estado, ...extra });
  await createOrderService(orden.id, { amount: importe });
  return orden;
}

describe('resumen de pago en la orden', () => {
  test('test_el_detalle_trae_payment_y_ticket_id_para_recepcion', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await ordenCobrable();
    await createPayment(orden.id, { amount: 400 });
    const ticket = await createTicket(orden.id);

    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual({
      total: 1000,
      paid: 400,
      pending: 0,
      balance: 600,
      available: 600,
      status: 'PARTIAL'
    });
    expect(res.body.data.ticketId).toBe(ticket.id);
  });

  test('test_una_orden_sin_ticket_trae_ticket_id_nulo_y_sin_pagos_queda_sin_pagar', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await ordenCobrable();

    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', auth);

    expect(res.body.data.ticketId).toBeNull();
    expect(res.body.data.payment).toEqual(expect.objectContaining({ paid: 0, status: 'UNPAID' }));
  });

  test('test_el_estado_incluye_los_cobros_pendientes_como_reservados', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await ordenCobrable();
    await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 700 });

    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', auth);

    expect(res.body.data.payment).toEqual(
      expect.objectContaining({ paid: 0, pending: 700, balance: 1000, available: 300, status: 'UNPAID' })
    );
  });

  test('test_el_mecanico_recibe_payment_y_payment_status_nulos', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await ordenCobrable('TERMINADO', 500, { mechanicId: mecanico.user.id });
    await createPayment(orden.id, { amount: 500 });

    const detalle = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', mecanico.auth);
    const listado = await request(app).get('/api/orders').set('Authorization', mecanico.auth);

    expect(detalle.body.data.payment).toBeNull();
    expect(detalle.body.data.ticketId).toBeNull();
    expect(listado.body.data[0].paymentStatus).toBeNull();
  });

  test('test_el_listado_trae_payment_status_por_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const sinPagar = await ordenCobrable('TERMINADO', 100);
    const parcial = await ordenCobrable('TERMINADO', 100);
    const pagada = await ordenCobrable('ENTREGADO', 100);
    const sinCobro = await createOrder({ status: 'TERMINADO' });
    await createPayment(parcial.id, { amount: 40 });
    await createPayment(pagada.id, { amount: 100 });

    const res = await request(app).get('/api/orders?pageSize=50').set('Authorization', auth);
    const porId = Object.fromEntries(res.body.data.map((o) => [o.id, o.paymentStatus]));

    expect(porId).toEqual({
      [sinPagar.id]: 'UNPAID',
      [parcial.id]: 'PARTIAL',
      [pagada.id]: 'PAID',
      [sinCobro.id]: 'NO_CHARGE'
    });
  });

  test('test_el_filtro_payment_status_devuelve_solo_las_ordenes_cobrables_que_coinciden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const sinPagar = await ordenCobrable('TERMINADO', 100);
    const parcial = await ordenCobrable('ENTREGADO', 100);
    const pagada = await ordenCobrable('ENTREGADO', 100);
    const enProceso = await ordenCobrable('EN_REPARACION', 100);
    await createPayment(parcial.id, { amount: 10 });
    await createPayment(pagada.id, { amount: 100 });

    const ids = async (estado) =>
      (await request(app).get(`/api/orders?paymentStatus=${estado}&pageSize=50`).set('Authorization', auth)).body.data
        .map((o) => o.id)
        .sort((a, b) => a - b);

    expect(await ids('UNPAID')).toEqual([sinPagar.id]);
    expect(await ids('PARTIAL')).toEqual([parcial.id]);
    expect(await ids('PAID')).toEqual([pagada.id]);
    expect(await ids('DUE')).toEqual([sinPagar.id, parcial.id].sort((a, b) => a - b));
    expect(await ids('DUE')).not.toContain(enProceso.id);
  });

  test('test_un_valor_invalido_del_filtro_responde_400', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await request(app).get('/api/orders?paymentStatus=NADA').set('Authorization', auth);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('paymentStatus');
  });

  test('test_el_mecanico_ignora_el_filtro_de_pago', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await ordenCobrable('TERMINADO', 100, { mechanicId: mecanico.user.id });
    await createPayment(orden.id, { amount: 100 });

    const res = await request(app).get('/api/orders?paymentStatus=UNPAID').set('Authorization', mecanico.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.map((o) => o.id)).toEqual([orden.id]);
  });

  test('test_los_pagos_anulados_cancelados_y_rechazados_no_cuentan_como_pagado', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await ordenCobrable('TERMINADO', 200);
    await createPayment(orden.id, { amount: 50, status: 'ANULADO' });
    await createPayment(orden.id, { amount: 60, status: 'CANCELADO' });
    await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 70, status: 'RECHAZADO' });

    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', auth);

    expect(res.body.data.payment).toEqual(expect.objectContaining({ paid: 0, pending: 0, status: 'UNPAID' }));
  });
});
