import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { instalarMercadoPagoSimulado } from '../fakeGateway.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
let mp;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () => crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 1000 });
const iniciar = async (orden, amount = 300) => {
  const r = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'MERCADO_PAGO', amount });
  return { respuesta: r, pago: r.body.data?.payment, referencia: mp.estado.preferencias.at(-1)?.external_reference };
};
const notificar = (id, type = 'payment') => request(app).post('/api/payments/mercadopago/webhook').send({ type, data: { id } });
const estadoDe = async (orden) => (await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'))).body.data;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

beforeEach(() => {
  mp = instalarMercadoPagoSimulado();
});

afterEach(() => mp.restaurar());

afterAll(cerrarConexiones);

describe('Pagos con Mercado Pago (integración, pasarela simulada en la red)', () => {
  test('el_flujo_Pendiente_a_Pagado_por_notificacion_actualiza_el_saldo', async () => {
    const orden = await nuevaOrden();
    const { pago, referencia } = await iniciar(orden);
    expect(pago.status).toBe('PENDIENTE');
    expect(mp.estado.preferencias[0]).toMatchObject({ items: [{ unit_price: 300, currency_id: 'MXN' }] });
    expect(mp.estado.llamadas[0].autorizacion).toMatch(/^Bearer TEST-/);

    const idExterno = mp.registrarPagoExterno({ externalReference: referencia, amount: 300 });
    expect((await notificar(idExterno)).status).toBe(200);
    const despues = await estadoDe(orden);
    expect(despues.payments[0].status).toBe('PAGADO');
    expect(despues.summary).toMatchObject({ paid: '300.00', pending: '0.00', status: 'PARCIAL' });
  });

  test('el_flujo_Pendiente_a_Pagado_por_sincronizacion_manual', async () => {
    const orden = await nuevaOrden();
    const { pago, referencia } = await iniciar(orden, 1000);
    mp.registrarPagoExterno({ externalReference: referencia, amount: 1000 });
    const respuesta = await request(app).post(`/api/payments/${pago.id}/sync`).set(como('RECEPTIONIST'));
    expect(respuesta.body.data.summary.status).toBe('PAGADA');
  });

  test('rechazado_y_cancelado_liberan_el_saldo_y_permiten_iniciar_otro_pago', async () => {
    const orden = await nuevaOrden();
    for (const estado of ['rejected', 'cancelled']) {
      const { pago, referencia } = await iniciar(orden, 1000);
      const id = mp.registrarPagoExterno({ externalReference: referencia, amount: 1000, status: estado });
      await notificar(id);
      expect((await estadoDe(orden)).payments.find((p) => p.id === pago.id).status).toBe(estado === 'rejected' ? 'RECHAZADO' : 'CANCELADO');
    }
    const final = await estadoDe(orden);
    expect(final.summary).toMatchObject({ paid: '0.00', pending: '0.00', available: '1000.00' });
  });

  test('diez_notificaciones_identicas_simultaneas_dejan_un_solo_cambio', async () => {
    const orden = await nuevaOrden();
    const { referencia } = await iniciar(orden, 400);
    const id = mp.registrarPagoExterno({ externalReference: referencia, amount: 400 });
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => notificar(id)));
    expect(respuestas.every((r) => r.status === 200)).toBe(true);
    const { payments, summary } = await estadoDe(orden);
    expect(payments).toHaveLength(1);
    expect(summary.paid).toBe('400.00');
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM payments WHERE orderId = ? AND status = 'PAGADO'", [orden]);
    expect(total).toBe(1);
  });

  test('prevalece_el_estado_real_de_mercado_pago_y_no_lo_que_afirme_la_notificacion', async () => {
    const orden = await nuevaOrden();
    const { referencia } = await iniciar(orden, 300);
    const id = mp.registrarPagoExterno({ externalReference: referencia, amount: 300, status: 'rejected' });
    // La notificación "dice" payment, pero el estado real (consultado a Mercado Pago) es rechazado.
    await request(app).post('/api/payments/mercadopago/webhook').send({ type: 'payment', action: 'payment.approved', status: 'approved', data: { id, status: 'approved' } });
    expect((await estadoDe(orden)).payments[0].status).toBe('RECHAZADO');
  });

  test('una_notificacion_falsa_de_un_pago_inexistente_o_ajeno_no_altera_ningun_pago', async () => {
    const orden = await nuevaOrden();
    const { referencia } = await iniciar(orden, 300);
    await notificar('99999999');
    const ajeno = mp.registrarPagoExterno({ externalReference: 'referencia-de-otro-sistema', amount: 300 });
    await notificar(ajeno);
    const conOtroImporte = mp.registrarPagoExterno({ externalReference: referencia, amount: 5 });
    await notificar(conOtroImporte);
    const { payments } = await estadoDe(orden);
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('PENDIENTE');
  });

  test('el_pago_pendiente_reserva_saldo_y_bloquea_sobrecobros', async () => {
    const orden = await nuevaOrden();
    await iniciar(orden, 800);
    const exceso = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 300 });
    expect(exceso.status).toBe(409);
    expect(exceso.body.error).toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE', balance: '200.00' });
    expect((await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 200 })).status).toBe(201);
  });

  test('cancelar_un_pago_pendiente_libera_el_saldo_y_cancelar_uno_pagado_responde_409', async () => {
    const orden = await nuevaOrden();
    const { pago, referencia } = await iniciar(orden, 500);
    expect((await request(app).post(`/api/payments/${pago.id}/cancel`).set(como('RECEPTIONIST'))).status).toBe(200);
    expect((await estadoDe(orden)).summary.available).toBe('1000.00');

    const otro = await iniciar(orden, 500);
    const id = mp.registrarPagoExterno({ externalReference: mp.estado.preferencias.at(-1).external_reference, amount: 500 });
    await notificar(id);
    const tarde = await request(app).post(`/api/payments/${otro.pago.id}/cancel`).set(como('RECEPTIONIST'));
    expect(tarde.status).toBe(409);
    expect(referencia).toBeDefined();
  });

  test('una_aprobacion_tardia_de_un_pago_cancelado_se_ignora', async () => {
    const orden = await nuevaOrden();
    const { pago, referencia } = await iniciar(orden, 300);
    await request(app).post(`/api/payments/${pago.id}/cancel`).set(como('RECEPTIONIST'));
    const id = mp.registrarPagoExterno({ externalReference: referencia, amount: 300 });
    await notificar(id);
    const { payments, summary } = await estadoDe(orden);
    expect(payments[0].status).toBe('CANCELADO');
    expect(summary.paid).toBe('0.00');
  });

  test('el_webhook_funciona_sin_sesion_y_las_demas_rutas_de_pagos_la_exigen', async () => {
    expect((await notificar('1')).status).toBe(200);
    expect((await request(app).post('/api/payments/1/sync')).status).toBe(401);
    expect((await request(app).post('/api/payments/1/cancel')).status).toBe(401);
    expect((await request(app).post('/api/payments/1/sync').set(como('MECHANIC'))).status).toBe(403);
  });

  test('el_token_de_acceso_nunca_aparece_en_las_respuestas_de_error', async () => {
    mp.estado.caido = true;
    const orden = await nuevaOrden();
    const respuesta = await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'MERCADO_PAGO', amount: 100 });
    expect(JSON.stringify(respuesta.body)).not.toMatch(/TEST-/);
  });
});
