// Contrato de los pagos con Mercado Pago, sync, cancel y webhook (specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { signNotification } from '../../services/webhookVerifier.js';
import { instalarMercadoPagoSimulado } from '../fakeGateway.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
let mp;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () => crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 1000 });
const iniciar = (orden, amount = 300) =>
  request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'MERCADO_PAGO', amount });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

beforeEach(() => {
  mp = instalarMercadoPagoSimulado();
});

afterEach(() => {
  mp.restaurar();
  env.mercadoPago.webhookSecret = '';
});

afterAll(cerrarConexiones);

describe('POST /api/orders/:id/payments con MERCADO_PAGO', () => {
  test('responde_201_con_el_pago_PENDIENTE_el_enlace_y_el_importe_reservado', async () => {
    const orden = await nuevaOrden();
    const respuesta = await iniciar(orden);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.payment).toMatchObject({
      method: 'MERCADO_PAGO',
      status: 'PENDIENTE',
      amount: '300.00',
      paidAt: null,
      paymentLink: expect.stringMatching(/^https:\/\/sandbox\.mercadopago\.test\/pagar\//),
    });
    expect(respuesta.body.data.summary).toMatchObject({ paid: '0.00', pending: '300.00', available: '700.00' });
    expect(JSON.stringify(respuesta.body)).not.toContain(env.mercadoPago.accessToken);
  });

  test('responde_503_MP_NOT_CONFIGURED_sin_credenciales_y_no_crea_ningun_pago', async () => {
    mp.restaurar();
    mp = instalarMercadoPagoSimulado({ configurado: false });
    const orden = await nuevaOrden();
    const respuesta = await iniciar(orden);
    expect(respuesta.status).toBe(503);
    expect(respuesta.body).toEqual({ error: { code: 'MP_NOT_CONFIGURED', message: expect.any(String) } });
    const lista = await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'));
    expect(lista.body.data.payments).toEqual([]);
  });

  test('responde_502_MP_UNAVAILABLE_si_mercado_pago_no_responde_y_no_crea_ningun_pago', async () => {
    mp.estado.caido = true;
    const orden = await nuevaOrden();
    const respuesta = await iniciar(orden);
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.error.code).toBe('MP_UNAVAILABLE');
    expect((await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'))).body.data.payments).toEqual([]);
  });
});

describe('POST /api/payments/:id/sync y /cancel', () => {
  test('sync_responde_200_con_payment_y_summary_y_aplica_la_aprobacion', async () => {
    const orden = await nuevaOrden();
    const { body } = await iniciar(orden);
    const pago = body.data.payment;
    const referencia = mp.estado.preferencias[0].external_reference;
    mp.registrarPagoExterno({ externalReference: referencia, amount: 300 });
    const respuesta = await request(app).post(`/api/payments/${pago.id}/sync`).set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.payment.status).toBe('PAGADO');
    expect(respuesta.body.data.summary).toMatchObject({ paid: '300.00', pending: '0.00' });
    expect(respuesta.body.data.payment).not.toHaveProperty('externalReference');
  });

  test('sync_y_cancel_responden_409_PAYMENT_NOT_PENDING_si_ya_no_esta_pendiente', async () => {
    const orden = await nuevaOrden();
    const efectivo = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 100 });
    for (const accion of ['sync', 'cancel']) {
      const respuesta = await request(app).post(`/api/payments/${efectivo.body.data.payment.id}/${accion}`).set(como('RECEPTIONIST'));
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('PAYMENT_NOT_PENDING');
    }
  });

  test('cancel_responde_200_libera_el_saldo_y_404_si_no_existe', async () => {
    const orden = await nuevaOrden();
    const { body } = await iniciar(orden, 1000);
    const respuesta = await request(app).post(`/api/payments/${body.data.payment.id}/cancel`).set(como('ADMIN'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.payment.status).toBe('CANCELADO');
    expect(respuesta.body.data.summary).toMatchObject({ pending: '0.00', available: '1000.00' });
    expect((await request(app).post('/api/payments/999999/cancel').set(como('ADMIN'))).status).toBe(404);
  });

  test('sync_responde_502_si_mercado_pago_no_responde', async () => {
    const orden = await nuevaOrden();
    const { body } = await iniciar(orden);
    mp.estado.caido = true;
    const respuesta = await request(app).post(`/api/payments/${body.data.payment.id}/sync`).set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(502);
    expect(respuesta.body.error.code).toBe('MP_UNAVAILABLE');
  });
});

describe('POST /api/payments/mercadopago/webhook (pública)', () => {
  test('responde_200_received_true_sin_sesion_aunque_no_corresponda_a_ningun_pago', async () => {
    const respuesta = await request(app).post('/api/payments/mercadopago/webhook').send({ type: 'payment', data: { id: '424242' } });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: { received: true } });
  });

  test('otros_tipos_de_notificacion_responden_200_sin_consultar_a_mercado_pago', async () => {
    const respuesta = await request(app).post('/api/payments/mercadopago/webhook').send({ type: 'merchant_order', data: { id: '1' } });
    expect(respuesta.status).toBe(200);
    expect(mp.estado.llamadas).toHaveLength(0);
  });

  test('responde_400_si_esta_mal_formada', async () => {
    for (const cuerpo of [{}, { type: 'payment' }, { type: 'payment', data: { id: 'abc' } }]) {
      const respuesta = await request(app).post('/api/payments/mercadopago/webhook').send(cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('con_secreto_configurado_responde_401_si_la_firma_no_coincide_y_200_si_es_valida', async () => {
    env.mercadoPago.webhookSecret = 'secreto-de-prueba';
    const cuerpo = { type: 'payment', data: { id: '555' } };
    const sinFirma = await request(app).post('/api/payments/mercadopago/webhook').send(cuerpo);
    expect(sinFirma.status).toBe(401);
    expect(sinFirma.body.error.code).toBe('INVALID_SIGNATURE');
    const mala = await request(app).post('/api/payments/mercadopago/webhook').set('x-signature', 'ts=1,v1=00').set('x-request-id', 'r1').send(cuerpo);
    expect(mala.status).toBe(401);
    const firma = signNotification({ secret: 'secreto-de-prueba', requestId: 'r1', dataId: '555', ts: '1700000000' });
    const buena = await request(app).post('/api/payments/mercadopago/webhook').set('x-signature', firma).set('x-request-id', 'r1').send(cuerpo);
    expect(buena.status).toBe(200);
  });
});
