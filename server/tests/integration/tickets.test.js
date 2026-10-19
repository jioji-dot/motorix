import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearPago, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = (extra = {}) =>
  crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 1000, ...extra });
const pagar = (orden, cuerpo) => request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send(cuerpo);
const ticket = (orden, rol = 'RECEPTIONIST') => request(app).post(`/api/orders/${orden}/ticket`).set(como(rol));

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Tickets (integración)', () => {
  test('los_importes_del_ticket_coinciden_con_la_orden_y_sus_pagos_en_cada_etapa', async () => {
    const orden = await nuevaOrden();
    await pool.execute('INSERT INTO order_labor (orderId, description, hours, hourlyRate) VALUES (?, ?, ?, ?)', [orden, 'Mano de obra', 2, 100]);
    await pool.execute('UPDATE service_orders SET total = 1200 WHERE id = ?', [orden]);

    const sinPagos = (await ticket(orden)).body.data;
    expect(sinPagos).toMatchObject({ subtotal: '1200.00', total: '1200.00', payment: { status: 'SIN_PAGOS', methods: [], balance: '1200.00' } });

    await pagar(orden, { method: 'EFECTIVO', amount: 500 });
    const parcial = (await ticket(orden)).body.data;
    expect(parcial.payment).toEqual({ methods: ['EFECTIVO'], status: 'PARCIAL', paid: '500.00', balance: '700.00' });

    await pagar(orden, { method: 'TARJETA', amount: 700, reference: 'AUT 1' });
    const completo = (await ticket(orden)).body.data;
    expect(completo.payment).toEqual({ methods: ['EFECTIVO', 'TARJETA'], status: 'PAGADA', paid: '1200.00', balance: '0.00' });
    expect(completo.subtotal).toBe(completo.total);
  });

  test('regenerar_conserva_el_folio_y_actualiza_el_pago_principal', async () => {
    const orden = await nuevaOrden();
    const primero = (await ticket(orden)).body.data;
    const pago = await pagar(orden, { method: 'TRANSFERENCIA', amount: 300, reference: 'SPEI 2' });
    const segundo = await ticket(orden, 'ADMIN');
    expect(segundo.status).toBe(200);
    expect(segundo.body.data.folio).toBe(primero.folio);
    expect(segundo.body.data.payment.methods).toEqual(['TRANSFERENCIA']);
    const [[fila]] = await pool.query('SELECT paymentId FROM tickets WHERE orderId = ?', [orden]);
    expect(fila.paymentId).toBe(pago.body.data.payment.id);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tickets WHERE orderId = ?', [orden]);
    expect(total).toBe(1);
  });

  test('diez_generaciones_simultaneas_crean_un_solo_ticket', async () => {
    const orden = await nuevaOrden();
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => ticket(orden)));
    expect(respuestas.every((r) => [200, 201].includes(r.status))).toBe(true);
    expect(new Set(respuestas.map((r) => r.body.data.folio)).size).toBe(1);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tickets WHERE orderId = ?', [orden]);
    expect(total).toBe(1);
  });

  test('los_pagos_rechazados_y_pendientes_no_cuentan_en_el_ticket', async () => {
    const orden = await nuevaOrden();
    await crearPago({ orderId: orden, createdBy: usuarios.ADMIN.id, amount: 1000, method: 'MERCADO_PAGO', status: 'RECHAZADO', externalReference: 'rr-1' });
    await crearPago({ orderId: orden, createdBy: usuarios.ADMIN.id, amount: 300, method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'rr-2' });
    expect((await ticket(orden)).body.data.payment).toMatchObject({ status: 'SIN_PAGOS', methods: [], paid: '0.00' });
  });

  test('una_orden_con_total_cero_muestra_Sin_cobro', async () => {
    const orden = await nuevaOrden({ total: 0 });
    expect((await ticket(orden)).body.data).toMatchObject({ total: '0.00', payment: { status: 'SIN_COBRO' } });
  });

  test('el_ticket_incluye_refacciones_y_el_kilometraje_del_servicio', async () => {
    const orden = await nuevaOrden();
    await pool.execute('UPDATE service_orders SET serviceMileage = 40350 WHERE id = ?', [orden]);
    await pool.execute(
      "INSERT INTO parts (code, name, category, brand, stock, minimumStock, purchasePrice, salePrice) VALUES ('TK-P', 'Pieza', 'x', 'x', 5, 1, 1, 100)",
    );
    const [[parte]] = await pool.query("SELECT id FROM parts WHERE code = 'TK-P'");
    await pool.execute('INSERT INTO order_parts (orderId, partId, partCode, partName, quantity, unitPrice) VALUES (?, ?, ?, ?, ?, ?)', [orden, parte.id, 'TK-P', 'Pieza', 2, 100]);
    await pool.execute('UPDATE service_orders SET total = 1200 WHERE id = ?', [orden]);
    const t = (await ticket(orden)).body.data;
    expect(t.vehicle.mileage).toBe(40350);
    expect(t.parts).toEqual([{ name: 'Pieza', quantity: 2, unitPrice: '100.00', amount: '200.00' }]);
    expect(t.subtotal).toBe('1200.00');
  });

  test('el_ticket_no_cambia_de_folio_cuando_la_orden_pasa_a_entregada', async () => {
    const orden = await nuevaOrden();
    const antes = (await ticket(orden)).body.data;
    await pagar(orden, { method: 'EFECTIVO', amount: 1000 });
    await request(app).post(`/api/orders/${orden}/status`).set(como('RECEPTIONIST')).send({ status: 'ENTREGADO' });
    const despues = (await request(app).get(`/api/orders/${orden}/ticket`).set(como('ADMIN'))).body.data;
    expect(despues.folio).toBe(antes.folio);
    expect(despues.order.status).toBe('ENTREGADO');
    expect(despues.payment.status).toBe('PAGADA');
  });

  test('recepcion_y_administracion_pueden_y_el_mecanico_no', async () => {
    const orden = await nuevaOrden();
    expect((await ticket(orden, 'RECEPTIONIST')).status).toBe(201);
    expect((await ticket(orden, 'ADMIN')).status).toBe(200);
    expect((await ticket(orden, 'MECHANIC')).status).toBe(403);
  });
});
