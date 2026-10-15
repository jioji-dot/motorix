// Pruebas de contrato del cobro con Mercado Pago (ver specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createOrderService } from '../helpers/factories.js';
import * as stub from '../helpers/mercadoPagoStub.js';

const app = createApp();

const FORMA_PAGO_MP = {
  id: expect.any(Number),
  orderId: expect.any(Number),
  orderFolio: expect.stringMatching(/^OS-\d{6}$/),
  clientName: expect.any(String),
  vehiclePlate: expect.any(String),
  method: 'MERCADO_PAGO',
  amount: expect.any(Number),
  status: 'PENDIENTE',
  reference: null,
  externalReference: expect.stringMatching(/^MTX-OS-\d{6}-[0-9A-F]{8}$/),
  paymentUrl: expect.stringMatching(/^https:\/\//),
  voidReason: null,
  voidedByName: null,
  voidedAt: null,
  createdByName: expect.any(String),
  createdAt: expect.any(String),
  canCancel: true,
  canVoid: false,
  canRefresh: true
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
let orden;

beforeAll(stub.start);
afterAll(async () => {
  await stub.stop();
  await closePool();
});

beforeEach(async () => {
  stub.reset();
  process.env.MP_ACCESS_TOKEN = stub.STUB_TOKEN;
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});

const cobrar = (cuerpo = {}) =>
  request(app).post(`/api/orders/${orden.id}/payments/mercado-pago`).set('Authorization', recepcion.auth).send(cuerpo);

describe('contrato del cobro con Mercado Pago', () => {
  test('test_crear_el_cobro_responde_201_con_pago_pendiente_y_resumen', async () => {
    const res = await cobrar({ amount: 500 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toEqual({ ...FORMA_PAGO_MP, amount: 500 });
    expect(res.body.data.summary).toEqual({ ...FORMA_RESUMEN, pending: 500, available: 500 });
  });

  test('test_actualizar_el_estado_responde_200_con_pago_y_resumen', async () => {
    const pago = (await cobrar()).body.data.payment;
    stub.setPayments(pago.externalReference, [{ id: 1, status: 'approved', date_created: '2026-10-14T10:00:00.000-06:00' }]);

    const res = await request(app).post(`/api/payments/${pago.id}/refresh`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      payment: expect.objectContaining({ id: pago.id, status: 'APROBADO', canRefresh: false }),
      summary: { ...FORMA_RESUMEN, paid: 1000, status: 'PAID' }
    });
  });

  test('test_un_cobro_pendiente_existente_responde_409_con_details', async () => {
    await cobrar({ amount: 200 });

    const res = await cobrar({ amount: 100 });

    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'PAYMENT_PENDING_EXISTS',
      message: expect.any(String),
      details: { pending: { id: expect.any(Number), amount: 200, externalReference: expect.any(String) } }
    });
  });

  test('test_sin_configuracion_responde_503_con_el_formato_estandar', async () => {
    delete process.env.MP_ACCESS_TOKEN;

    const res = await cobrar();

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'PAYMENT_PROVIDER_UNAVAILABLE', message: expect.any(String) }
    });
  });

  test('test_los_errores_de_validacion_y_acceso_usan_el_formato_estandar', async () => {
    const invalido = await cobrar({ amount: -5 });
    const sinToken = await request(app).post(`/api/orders/${orden.id}/payments/mercado-pago`).send({});
    const sinPago = await request(app).post('/api/payments/999999/refresh').set('Authorization', recepcion.auth);

    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe('VALIDATION_ERROR');
    expect(sinToken.status).toBe(401);
    expect(sinPago.status).toBe(404);
  });
});
