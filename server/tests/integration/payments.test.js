import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearOrdenCobrable, crearPago, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = (extra = {}) =>
  crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 1000, ...extra });
const pagar = (orden, cuerpo, rol = 'RECEPTIONIST') => request(app).post(`/api/orders/${orden}/payments`).set(como(rol)).send(cuerpo);

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

describe('Pagos (integración)', () => {
  test('un_pago_parcial_y_luego_el_saldo_exacto_dejan_la_orden_PAGADA_y_rechazan_mas_pagos', async () => {
    const orden = await nuevaOrden();
    const parcial = await pagar(orden, { method: 'EFECTIVO', amount: 400 });
    expect(parcial.body.data.summary.status).toBe('PARCIAL');
    const final = await pagar(orden, { method: 'TARJETA', amount: 600, reference: 'AUT 998877' });
    expect(final.status).toBe(201);
    expect(final.body.data.summary).toMatchObject({ status: 'PAGADA', balance: '0.00', available: '0.00' });
    const extra = await pagar(orden, { method: 'EFECTIVO', amount: 0.01 });
    expect(extra.status).toBe(409);
    expect(extra.body.error).toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE', balance: '0.00' });
  });

  test('recepcion_y_administracion_pueden_cobrar_y_el_mecanico_recibe_403', async () => {
    const orden = await nuevaOrden();
    expect((await pagar(orden, { method: 'EFECTIVO', amount: 100 }, 'RECEPTIONIST')).status).toBe(201);
    expect((await pagar(orden, { method: 'EFECTIVO', amount: 100 }, 'ADMIN')).status).toBe(201);
    expect((await pagar(orden, { method: 'EFECTIVO', amount: 100 }, 'MECHANIC')).status).toBe(403);
    expect((await request(app).get(`/api/orders/${orden}/payments`).set(como('MECHANIC'))).status).toBe(403);
  });

  test('las_ordenes_en_curso_y_canceladas_no_admiten_pagos_y_las_entregadas_si', async () => {
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'CANCELADA']) {
      const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status });
      const respuesta = await pagar(orden, { method: 'EFECTIVO', amount: 10 });
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('ORDER_NOT_PAYABLE');
    }
    const entregada = await nuevaOrden({ status: 'ENTREGADO' });
    expect((await pagar(entregada, { method: 'EFECTIVO', amount: 100 })).status).toBe(201);
    // La entrega no exige que esté pagada: sigue admitiendo pagos hasta cubrir el saldo.
    expect((await pagar(entregada, { method: 'TRANSFERENCIA', amount: 900 })).body.data.summary.status).toBe('PAGADA');
  });

  test('una_orden_con_total_cero_no_admite_pagos', async () => {
    const orden = await nuevaOrden({ total: 0 });
    expect((await pagar(orden, { method: 'EFECTIVO', amount: 1 })).body.error.code).toBe('ORDER_NOT_PAYABLE');
  });

  test('diez_cobros_simultaneos_que_juntos_exceden_el_saldo_nunca_pasan_del_total', async () => {
    const orden = await nuevaOrden();
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => pagar(orden, { method: 'EFECTIVO', amount: 300 })));
    const aplicados = respuestas.filter((r) => r.status === 201).length;
    const rechazados = respuestas.filter((r) => r.status === 409);
    expect(aplicados).toBe(3); // 3 × 300 = 900; el cuarto de 300 no cabe en los 100 restantes
    expect(rechazados).toHaveLength(7);
    expect(rechazados.every((r) => r.body.error.code === 'PAYMENT_EXCEEDS_BALANCE')).toBe(true);
    const [[{ suma }]] = await pool.query("SELECT SUM(amount) AS suma FROM payments WHERE orderId = ? AND status = 'PAGADO'", [orden]);
    expect(Number(suma)).toBe(900);
  });

  test('cobros_simultaneos_por_el_saldo_exacto_dejan_solo_uno', async () => {
    const orden = await nuevaOrden();
    const respuestas = await Promise.all([pagar(orden, { method: 'EFECTIVO', amount: 1000 }), pagar(orden, { method: 'TARJETA', amount: 1000 })]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  test('los_pagos_rechazados_y_cancelados_no_cuentan_para_el_saldo_y_se_conservan', async () => {
    const orden = await nuevaOrden();
    await crearPago({ orderId: orden, createdBy: usuarios.ADMIN.id, amount: 1000, method: 'MERCADO_PAGO', status: 'RECHAZADO', externalReference: 'r-rech' });
    await crearPago({ orderId: orden, createdBy: usuarios.ADMIN.id, amount: 1000, method: 'MERCADO_PAGO', status: 'CANCELADO', externalReference: 'r-canc' });
    const respuesta = await pagar(orden, { method: 'EFECTIVO', amount: 1000 });
    expect(respuesta.status).toBe(201);
    const lista = await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'));
    expect(lista.body.data.payments.map((p) => p.status).sort()).toEqual(['CANCELADO', 'PAGADO', 'RECHAZADO']);
  });

  test('los_pagos_no_se_editan_ni_se_eliminan_no_hay_rutas_para_ello', async () => {
    const orden = await nuevaOrden();
    const { body } = await pagar(orden, { method: 'EFECTIVO', amount: 100 });
    const id = body.data.payment.id;
    for (const metodo of ['patch', 'put', 'delete']) {
      for (const ruta of [`/api/payments/${id}`, `/api/orders/${orden}/payments/${id}`]) {
        expect((await request(app)[metodo](ruta).set(como('ADMIN')).send({ amount: 1 })).status).toBe(404);
      }
    }
  });

  test('la_base_rechaza_pagos_incoherentes_aunque_falle_la_validacion', async () => {
    const orden = await nuevaOrden();
    const insertar = (valores) =>
      pool.execute(
        `INSERT INTO payments (orderId, amount, method, status, paidAt, externalReference, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orden, ...valores, usuarios.ADMIN.id],
      );
    await expect(insertar([0, 'EFECTIVO', 'PAGADO', null, null])).rejects.toThrow(); // importe cero
    await expect(insertar([10, 'EFECTIVO', 'PENDIENTE', null, null])).rejects.toThrow(); // solo Mercado Pago puede nacer pendiente
    await expect(insertar([10, 'MERCADO_PAGO', 'PENDIENTE', new Date(), 'x'])).rejects.toThrow(); // paidAt sin estar pagado
    await expect(insertar([10, 'EFECTIVO', 'PAGADO', null, 'ref-ajena'])).rejects.toThrow(); // campos de Mercado Pago en otro método
    await expect(insertar([10, 'MERCADO_PAGO', 'PENDIENTE', null, 'ok-ref'])).resolves.toBeDefined();
  });

  test('el_pago_se_conserva_cuando_la_orden_pasa_a_entregada', async () => {
    const orden = await nuevaOrden();
    await pagar(orden, { method: 'EFECTIVO', amount: 1000 });
    const entrega = await request(app).post(`/api/orders/${orden}/status`).set(como('RECEPTIONIST')).send({ status: 'ENTREGADO' });
    expect(entrega.status).toBe(200);
    const lista = await request(app).get(`/api/orders/${orden}/payments`).set(como('ADMIN'));
    expect(lista.body.data).toMatchObject({ payments: [{ status: 'PAGADO' }], summary: { status: 'PAGADA' } });
  });
});
