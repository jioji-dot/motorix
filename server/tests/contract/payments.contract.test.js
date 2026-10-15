// Pruebas de contrato de pagos (ver specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createOrder,
  createOrderService,
  createPayment,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const FORMA_PAGO = {
  id: expect.any(Number),
  orderId: expect.any(Number),
  orderFolio: expect.stringMatching(/^OS-\d{6}$/),
  clientName: expect.any(String),
  vehiclePlate: expect.any(String),
  method: expect.stringMatching(/^(CASH|CARD|TRANSFER|MERCADO_PAGO)$/),
  amount: expect.any(Number),
  status: expect.stringMatching(/^(PENDIENTE|APROBADO|RECHAZADO|CANCELADO|ANULADO)$/),
  reference: null,
  externalReference: null,
  paymentUrl: null,
  voidReason: null,
  voidedByName: null,
  voidedAt: null,
  createdByName: expect.any(String),
  createdAt: expect.any(String),
  canCancel: expect.any(Boolean),
  canVoid: expect.any(Boolean),
  canRefresh: expect.any(Boolean)
};

const FORMA_RESUMEN = {
  total: expect.any(Number),
  paid: expect.any(Number),
  pending: expect.any(Number),
  balance: expect.any(Number),
  available: expect.any(Number),
  status: expect.stringMatching(/^(NO_CHARGE|UNPAID|PARTIAL|PAID)$/)
};

let recepcion;
let admin;
let orden;

beforeEach(async () => {
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  admin = await createAuthenticated('ADMIN');
  const cliente = await createClient({ name: 'Ana Pérez' });
  const vehiculo = await createVehicle(cliente.id, { licensePlate: 'ABC123' });
  orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});
afterAll(closePool);

describe('contrato de pagos', () => {
  test('test_registrar_responde_201_con_pago_y_resumen', async () => {
    const res = await request(app)
      .post(`/api/orders/${orden.id}/payments`)
      .set('Authorization', recepcion.auth)
      .send({ method: 'CASH', amount: 400 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toEqual({
      ...FORMA_PAGO,
      orderFolio: orden.folio,
      clientName: 'Ana Pérez',
      vehiclePlate: 'ABC123',
      method: 'CASH',
      amount: 400,
      status: 'APROBADO',
      createdByName: recepcion.user.name,
      canCancel: false,
      canVoid: false,
      canRefresh: false
    });
    expect(res.body.data.summary).toEqual({
      ...FORMA_RESUMEN,
      total: 1000,
      paid: 400,
      pending: 0,
      balance: 600,
      available: 600,
      status: 'PARTIAL'
    });
  });

  test('test_los_pagos_de_una_orden_devuelven_resumen_y_lista', async () => {
    await createPayment(orden.id, { amount: 250.5 });

    const res = await request(app).get(`/api/orders/${orden.id}/payments`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual(expect.objectContaining({ ...FORMA_RESUMEN, paid: 250.5, balance: 749.5 }));
    expect(res.body.data.payments).toEqual([expect.objectContaining({ ...FORMA_PAGO, amount: 250.5 })]);
  });

  test('test_el_administrador_ve_can_void_verdadero_en_pagos_aprobados', async () => {
    await createPayment(orden.id, { amount: 100 });

    const res = await request(app).get(`/api/orders/${orden.id}/payments`).set('Authorization', admin.auth);

    expect(res.body.data.payments[0].canVoid).toBe(true);
  });

  test('test_el_listado_devuelve_data_y_meta_con_el_total_aprobado', async () => {
    await createPayment(orden.id, { amount: 300 });
    await createPayment(orden.id, { amount: 200 });
    await createPayment(orden.id, { amount: 100, status: 'CANCELADO' });

    const res = await request(app).get('/api/payments').set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 3, approvedTotal: 500 });
  });

  test('test_el_detalle_devuelve_el_pago', async () => {
    const pago = await createPayment(orden.id, { amount: 100, method: 'CARD', reference: 'AUT-1' });

    const res = await request(app).get(`/api/payments/${pago.id}`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_PAGO, method: 'CARD', reference: 'AUT-1' }));
  });

  test('test_cancelar_un_pendiente_responde_200_con_pago_y_resumen', async () => {
    const pago = await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 300 });

    const res = await request(app).post(`/api/payments/${pago.id}/cancel`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual(expect.objectContaining({ status: 'CANCELADO' }));
    expect(res.body.data.summary).toEqual(expect.objectContaining({ pending: 0, available: 1000 }));
  });

  test('test_anular_responde_200_con_motivo_usuario_y_fecha', async () => {
    const pago = await createPayment(orden.id, { amount: 300 });

    const res = await request(app)
      .post(`/api/payments/${pago.id}/void`)
      .set('Authorization', admin.auth)
      .send({ reason: 'Cobro duplicado' });

    expect(res.status).toBe(200);
    expect(res.body.data.payment).toEqual(
      expect.objectContaining({
        status: 'ANULADO',
        voidReason: 'Cobro duplicado',
        voidedByName: admin.user.name,
        voidedAt: expect.any(String)
      })
    );
    expect(res.body.data.summary.paid).toBe(0);
  });

  test('test_el_importe_mayor_al_saldo_responde_409_con_details', async () => {
    const res = await request(app)
      .post(`/api/orders/${orden.id}/payments`)
      .set('Authorization', recepcion.auth)
      .send({ method: 'CASH', amount: 1000.01 });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'PAYMENT_EXCEEDS_BALANCE',
      message: expect.any(String),
      details: { available: 1000, requested: 1000.01 }
    });
  });

  test('test_una_orden_en_proceso_responde_409_payment_order_not_payable', async () => {
    const enProceso = await createOrder({ status: 'EN_REPARACION' });

    const res = await request(app)
      .post(`/api/orders/${enProceso.id}/payments`)
      .set('Authorization', recepcion.auth)
      .send({ method: 'CASH', amount: 10 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_ORDER_NOT_PAYABLE');
    expect(res.body.error.details).toEqual({ status: 'EN_REPARACION', total: 0 });
  });

  test('test_cancelar_un_pago_aprobado_responde_409_payment_invalid_state', async () => {
    const pago = await createPayment(orden.id, { amount: 100 });

    const res = await request(app).post(`/api/payments/${pago.id}/cancel`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_INVALID_STATE');
  });

  test('test_los_datos_invalidos_responden_400_validation_error_con_details', async () => {
    const res = await request(app)
      .post(`/api/orders/${orden.id}/payments`)
      .set('Authorization', recepcion.auth)
      .send({ method: 'CASH', amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'amount', message: expect.any(String) })])
    );
  });

  test('test_un_pago_inexistente_responde_404', async () => {
    const res = await request(app).get('/api/payments/9999').set('Authorization', recepcion.auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
