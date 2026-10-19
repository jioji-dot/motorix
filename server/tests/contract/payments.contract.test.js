// Contrato de GET y POST /api/orders/:id/payments (specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearOrdenCobrable, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = (extra = {}) =>
  crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 1000, ...extra });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('POST /api/orders/:id/payments', () => {
  test('responde_201_con_el_pago_PAGADO_y_el_resumen_actualizado', async () => {
    const orden = await nuevaOrden();
    const respuesta = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 400, reference: 'Recibo 15' });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.payment).toEqual({
      id: expect.any(Number),
      orderId: orden,
      amount: '400.00',
      method: 'EFECTIVO',
      status: 'PAGADO',
      reference: 'Recibo 15',
      paymentLink: null,
      paidAt: expect.any(String),
      createdBy: { id: usuarios.RECEPTIONIST.id, name: usuarios.RECEPTIONIST.name },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(respuesta.body.data.summary).toEqual({ total: '1000.00', paid: '400.00', pending: '0.00', balance: '600.00', available: '600.00', status: 'PARCIAL' });
  });

  test('responde_400_con_el_campo_en_details', async () => {
    const orden = await nuevaOrden();
    const respuesta = await request(app).post(`/api/orders/${orden}/payments`).set(como('ADMIN')).send({ method: 'CHEQUE', amount: 0 });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details.map((d) => d.field).sort()).toEqual(['amount', 'method']);
  });

  test('responde_404_si_la_orden_no_existe', async () => {
    const respuesta = await request(app).post('/api/orders/999999/payments').set(como('ADMIN')).send({ method: 'EFECTIVO', amount: 10 });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('responde_409_ORDER_NOT_PAYABLE_si_la_orden_esta_en_curso', async () => {
    const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'EN_REPARACION' });
    const respuesta = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 10 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  test('responde_409_PAYMENT_EXCEEDS_BALANCE_con_el_saldo_disponible', async () => {
    const orden = await nuevaOrden();
    const respuesta = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'TARJETA', amount: 1000.01 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error).toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE', balance: '1000.00' });
  });

  test('responde_403_al_mecanico_y_401_sin_token', async () => {
    const orden = await nuevaOrden();
    const mecanico = await request(app).post(`/api/orders/${orden}/payments`).set(como('MECHANIC')).send({ method: 'EFECTIVO', amount: 10 });
    expect(mecanico.status).toBe(403);
    expect(mecanico.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
    expect((await request(app).post(`/api/orders/${orden}/payments`).send({})).status).toBe(401);
  });
});

describe('GET /api/orders/:id/payments', () => {
  test('responde_200_con_los_pagos_del_mas_reciente_al_mas_antiguo_y_el_resumen', async () => {
    const orden = await nuevaOrden();
    await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 100 });
    await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'TRANSFERENCIA', amount: 200, reference: 'SPEI 1' });
    const respuesta = await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.payments.map((p) => p.method)).toEqual(['TRANSFERENCIA', 'EFECTIVO']);
    expect(respuesta.body.data.summary).toMatchObject({ paid: '300.00', balance: '700.00', status: 'PARCIAL' });
  });

  test('una_orden_sin_pagos_devuelve_lista_vacia_y_estado_SIN_PAGOS', async () => {
    const orden = await nuevaOrden();
    const respuesta = await request(app).get(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST'));
    expect(respuesta.body.data).toMatchObject({ payments: [], summary: { status: 'SIN_PAGOS' } });
  });

  test('responde_404_403_y_401', async () => {
    const orden = await nuevaOrden();
    expect((await request(app).get('/api/orders/999999/payments').set(como('ADMIN'))).status).toBe(404);
    expect((await request(app).get(`/api/orders/${orden}/payments`).set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${orden}/payments`)).status).toBe(401);
  });
});
