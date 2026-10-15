// Pruebas de integración de los métodos de pago manuales (US2) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createOrderService } from '../helpers/factories.js';

const app = createApp();

const pagar = (auth, orderId, cuerpo) =>
  request(app).post(`/api/orders/${orderId}/payments`).set('Authorization', auth).send(cuerpo);

let recepcion;
let admin;
let mecanico;
let orden;

beforeEach(async () => {
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  admin = await createAuthenticated('ADMIN');
  mecanico = await createAuthenticated('MECHANIC');
  orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});
afterAll(closePool);

describe('métodos manuales aprobados al instante', () => {
  test.each(['CASH', 'CARD', 'TRANSFER'])('test_%s_queda_aprobado_de_inmediato', async (method) => {
    const res = await pagar(recepcion.auth, orden.id, { method, amount: 250 });

    expect(res.status).toBe(201);
    expect(res.body.data.payment).toEqual(expect.objectContaining({ method, status: 'APROBADO', amount: 250 }));
    expect(res.body.data.summary).toEqual(expect.objectContaining({ paid: 250, balance: 750 }));
  });

  test('test_el_efectivo_con_importe_recibido_devuelve_el_cambio_y_no_lo_guarda', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CASH', amount: 380.5, receivedAmount: 500 });

    expect(res.status).toBe(201);
    expect(res.body.data.change).toBe(119.5);
    expect(res.body.data.payment).not.toHaveProperty('receivedAmount');
    expect(res.body.data.payment).not.toHaveProperty('change');

    const [columnas] = await pool.query(
      "SELECT COLUMN_NAME AS nombre FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'"
    );
    const nombres = columnas.map((c) => c.nombre.toLowerCase());
    expect(nombres.filter((n) => /received|change|cambio/.test(n))).toEqual([]);
  });

  test('test_el_efectivo_sin_importe_recibido_no_devuelve_cambio', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CASH', amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.change ?? null).toBeNull();
  });

  test('test_el_importe_recibido_igual_al_importe_da_cambio_cero', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CASH', amount: 100, receivedAmount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.change).toBe(0);
  });

  test('test_el_importe_recibido_menor_al_importe_se_rechaza', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CASH', amount: 300, receivedAmount: 299.99 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each(['CARD', 'TRANSFER'])('test_el_importe_recibido_con_%s_se_rechaza', async (method) => {
    const res = await pagar(recepcion.auth, orden.id, { method, amount: 300, receivedAmount: 300 });

    expect(res.status).toBe(400);
  });
});

describe('referencia de la operación', () => {
  test.each(['CARD', 'TRANSFER'])('test_la_referencia_se_conserva_con_%s', async (method) => {
    const res = await pagar(recepcion.auth, orden.id, { method, amount: 200, reference: 'AUT-889900' });

    expect(res.status).toBe(201);
    expect(res.body.data.payment.reference).toBe('AUT-889900');
  });

  test('test_la_referencia_de_100_caracteres_es_valida_y_de_101_se_rechaza', async () => {
    const valida = await pagar(recepcion.auth, orden.id, { method: 'CARD', amount: 100, reference: 'R'.repeat(100) });
    const larga = await pagar(recepcion.auth, orden.id, { method: 'CARD', amount: 100, reference: 'R'.repeat(101) });

    expect(valida.status).toBe(201);
    expect(larga.status).toBe(400);
  });

  test('test_la_referencia_con_efectivo_se_rechaza', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CASH', amount: 100, reference: 'X1' });

    expect(res.status).toBe(400);
  });
});

describe('métodos y campos no permitidos', () => {
  test('test_un_metodo_fuera_de_los_cuatro_se_rechaza', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'BITCOIN', amount: 100 });

    expect(res.status).toBe(400);
  });

  test('test_mercado_pago_no_se_registra_en_el_endpoint_manual', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'MERCADO_PAGO', amount: 100 });

    expect(res.status).toBe(400);
    expect((await pool.query('SELECT COUNT(*) AS n FROM payments'))[0][0].n).toBe(0);
  });

  test.each([
    ['cardNumber', '4111111111111111'],
    ['cvv', '123'],
    ['expiry', '12/30'],
    ['cardHolder', 'ANA PEREZ']
  ])('test_el_campo_de_tarjeta_%s_se_rechaza_y_no_se_guarda_el_pago', async (campo, valor) => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CARD', amount: 100, [campo]: valor });

    expect(res.status).toBe(400);
    expect((await pool.query('SELECT COUNT(*) AS n FROM payments'))[0][0].n).toBe(0);
  });

  test('test_la_respuesta_y_la_tabla_no_contienen_datos_de_tarjeta', async () => {
    const res = await pagar(recepcion.auth, orden.id, { method: 'CARD', amount: 100, reference: 'AUT-1' });

    expect(res.status).toBe(201);
    const texto = JSON.stringify(res.body).toLowerCase();
    expect(texto).not.toMatch(/cardnumber|cvv|expiry|cardholder/);

    const [columnas] = await pool.query(
      "SELECT COLUMN_NAME AS nombre FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'"
    );
    const nombres = columnas.map((c) => c.nombre.toLowerCase());
    expect(nombres.filter((n) => /card|cvv|expiry|pan/.test(n))).toEqual([]);
  });
});

describe('permisos', () => {
  test('test_recepcion_y_administracion_pueden_registrar_pagos', async () => {
    const a = await pagar(recepcion.auth, orden.id, { method: 'CASH', amount: 100 });
    const b = await pagar(admin.auth, orden.id, { method: 'TRANSFER', amount: 100 });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
  });

  test('test_el_mecanico_no_puede_registrar_pagos', async () => {
    const res = await pagar(mecanico.auth, orden.id, { method: 'CASH', amount: 100 });

    expect(res.status).toBe(403);
  });
});
