// Cobro de una orden con refacciones (Sprint 5, FR-015 a FR-017): el pago se valida contra el saldo disponible
// calculado con el total con refacciones, también con cobros simultáneos y con Mercado Pago.
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { instalarMercadoPagoSimulado } from '../fakeGateway.js';
import {
  cerrarConexiones,
  crearClienteConVehiculo,
  crearLineaDeRefaccion,
  crearOrden,
  crearOrdenCobrable,
  crearRefaccion,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let datos;
let mp;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const base = () => ({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id });
const pagar = (orden, cuerpo) => request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send(cuerpo);
const resumen = async (orden) => (await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'))).body.data;

// Orden Terminada de 700.00: servicio de 500.00 más dos piezas de 100.00.
async function ordenDe700() {
  const orden = await crearOrdenCobrable({ ...base(), total: 500 });
  const parte = await crearRefaccion({ stock: 20, purchasePrice: 40, salePrice: 100 });
  await crearLineaDeRefaccion({ orderId: orden, partId: parte.id, quantity: 2 });
  return orden;
}

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

describe('Cobro de una orden con refacciones (integración, Sprint 5)', () => {
  test('el_pago_por_el_saldo_con_refacciones_deja_la_orden_pagada', async () => {
    const orden = await ordenDe700();
    expect((await resumen(orden)).summary).toMatchObject({ total: '700.00', balance: '700.00', status: 'SIN_PAGOS' });
    expect((await pagar(orden, { method: 'EFECTIVO', amount: 300 })).status).toBe(201);
    expect((await resumen(orden)).summary).toMatchObject({ paid: '300.00', balance: '400.00', status: 'PARCIAL' });
    expect((await pagar(orden, { method: 'TRANSFERENCIA', amount: 400 })).status).toBe(201);
    expect((await resumen(orden)).summary).toMatchObject({ paid: '700.00', balance: '0.00', available: '0.00', status: 'PAGADA' });
  });

  test('un_importe_mayor_al_saldo_responde_409_PAYMENT_EXCEEDS_BALANCE_indicando_el_saldo', async () => {
    const orden = await ordenDe700();
    await pagar(orden, { method: 'EFECTIVO', amount: 300 });
    const respuesta = await pagar(orden, { method: 'EFECTIVO', amount: 400.01 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    expect(respuesta.body.error.message).toContain('400.00');
    expect((await resumen(orden)).summary.paid).toBe('300.00');
  });

  test('una_orden_terminada_con_solo_refacciones_se_cobra_y_una_de_total_cero_no', async () => {
    const soloPiezas = await crearOrden({ ...base(), status: 'TERMINADO', diagnosis: 'Solo piezas' });
    const parte = await crearRefaccion({ stock: 5, purchasePrice: 10, salePrice: 60 });
    await crearLineaDeRefaccion({ orderId: soloPiezas, partId: parte.id, quantity: 2 });
    expect((await resumen(soloPiezas)).summary.total).toBe('120.00');
    expect((await pagar(soloPiezas, { method: 'EFECTIVO', amount: 120 })).status).toBe(201);

    const sinNada = await crearOrden({ ...base(), status: 'TERMINADO', diagnosis: 'Sin cargos' });
    const rechazo = await pagar(sinNada, { method: 'EFECTIVO', amount: 1 });
    expect(rechazo.status).toBe(409);
    expect(rechazo.body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  test('ocho_cobros_simultaneos_nunca_superan_el_total_de_la_orden', async () => {
    const orden = await ordenDe700();
    const respuestas = await Promise.all(Array.from({ length: 8 }, () => pagar(orden, { method: 'EFECTIVO', amount: 300 })));
    const aceptadas = respuestas.filter((r) => r.status === 201).length;
    expect(aceptadas).toBe(2); // 2 × 300 = 600; un tercero dejaría 900 > 700
    for (const r of respuestas.filter((x) => x.status !== 201)) expect(r.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
    const [[{ pagado }]] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS pagado FROM payments WHERE orderId = ? AND status = 'PAGADO'", [orden]);
    expect(Number(pagado)).toBe(600);
  });

  test('el_cobro_de_Mercado_Pago_solicita_el_importe_correcto_y_no_guarda_datos_de_tarjeta', async () => {
    const orden = await ordenDe700();
    const respuesta = await pagar(orden, { method: 'MERCADO_PAGO', amount: 700 });
    expect(respuesta.status).toBe(201);
    expect(mp.estado.preferencias[0]).toMatchObject({ items: [{ unit_price: 700, currency_id: 'MXN' }] });

    const texto = JSON.stringify(respuesta.body);
    expect(texto).not.toMatch(/card|tarjeta_numero|cvv|cvc|securityCode/i);
    const [columnas] = await pool.query("SELECT COLUMN_NAME AS nombre FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'");
    expect(columnas.map((c) => c.nombre.toLowerCase()).filter((n) => /card|cvv|cvc|number|pan/.test(n))).toEqual([]);
  });
});
