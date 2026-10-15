// Pruebas de integración del panel de control (US5 y US6) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAppointment,
  createAuthenticated,
  createClient,
  createMaintenance,
  createOrder,
  createOrderService,
  createPart,
  createPayment,
  createVehicle,
  futureDateTime
} from '../helpers/factories.js';

const app = createApp();

const p2 = (n) => String(n).padStart(2, '0');
function fechaEn(dias) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
}

let admin;
let recepcion;
let mecanico;

const panel = async () => (await request(app).get('/api/dashboard').set('Authorization', admin.auth)).body.data;

/** Orden con un servicio por el importe indicado. */
async function ordenCon(status, importe, extra = {}) {
  const o = await createOrder({ status, ...extra });
  if (importe > 0) await createOrderService(o.id, { amount: importe });
  return o;
}

async function restaurarUmbrales() {
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES
       ('maintenance_warning_days', '30'), ('maintenance_warning_km', '1000')
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`
  );
}

beforeEach(async () => {
  await cleanTables();
  await restaurarUmbrales();
  admin = await createAuthenticated('ADMIN');
  recepcion = await createAuthenticated('RECEPTIONIST');
  mecanico = await createAuthenticated('MECHANIC');
});
afterAll(async () => {
  await restaurarUmbrales();
  await closePool();
});

describe('órdenes', () => {
  test('test_cuenta_las_ordenes_por_estado_y_coincide_con_el_listado', async () => {
    await ordenCon('RECIBIDO', 0);
    await ordenCon('RECIBIDO', 0);
    await ordenCon('DIAGNOSTICO', 0);
    await ordenCon('EN_REPARACION', 0);
    await ordenCon('ESPERANDO_REFACCION', 0);
    await ordenCon('TERMINADO', 100);

    const datos = await panel();

    expect(datos.orders).toEqual({
      received: 2,
      diagnosis: 1,
      inRepair: 1,
      waitingPart: 1,
      finishedNotDelivered: 1,
      deliveredToday: 0
    });
    for (const [estado, clave] of [
      ['RECIBIDO', 'received'],
      ['DIAGNOSTICO', 'diagnosis'],
      ['EN_REPARACION', 'inRepair'],
      ['ESPERANDO_REFACCION', 'waitingPart'],
      ['TERMINADO', 'finishedNotDelivered']
    ]) {
      const listado = await request(app).get('/api/orders').query({ status: estado }).set('Authorization', admin.auth);
      expect(listado.body.meta.total).toBe(datos.orders[clave]);
    }
  });

  test('test_las_entregadas_hoy_solo_cuentan_las_de_hoy', async () => {
    const hoy = await ordenCon('ENTREGADO', 100);
    const ayer = await ordenCon('ENTREGADO', 100);
    await pool.query('UPDATE service_orders SET delivered_at = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE id = ?', [ayer.id]);

    const datos = await panel();

    expect(datos.orders.deliveredToday).toBe(1);
    expect(hoy.id).toBeDefined();
  });

  test('test_entregar_una_orden_se_refleja_en_la_siguiente_consulta', async () => {
    const o = await ordenCon('TERMINADO', 100);
    const antes = await panel();

    await pool.query("UPDATE service_orders SET status = 'ENTREGADO', delivered_at = NOW() WHERE id = ?", [o.id]);
    const despues = await panel();

    expect(antes.orders).toEqual(expect.objectContaining({ finishedNotDelivered: 1, deliveredToday: 0 }));
    expect(despues.orders).toEqual(expect.objectContaining({ finishedNotDelivered: 0, deliveredToday: 1 }));
  });
});

describe('citas', () => {
  test('test_cuenta_solo_pendientes_y_confirmadas_de_hoy_y_de_los_proximos_7_dias', async () => {
    const cliente = await createClient({ name: 'Marta Ruiz' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'MRT555' });
    const cita = (dias, status = 'PENDIENTE', hora = 11) =>
      createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(dias, hora), status });

    await cita(0, 'PENDIENTE', 23);
    await cita(0, 'CONFIRMADA', 22);
    await cita(0, 'CANCELADA', 21);
    await cita(3, 'CONFIRMADA');
    await cita(7, 'PENDIENTE');
    await cita(8, 'PENDIENTE');
    await cita(2, 'COMPLETADA');
    await cita(2, 'EN_PROCESO');

    const datos = await panel();

    expect(datos.appointments.today).toBe(2);
    expect(datos.appointments.next7Days).toBe(4);
  });

  test('test_la_siguiente_cita_es_la_mas_proxima_pendiente_o_confirmada', async () => {
    const cliente = await createClient({ name: 'Luis Gómez' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'LGZ123' });
    await createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(5, 9), reason: 'Lejana' });
    await createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(1, 15), reason: 'Más cercana' });
    await createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(1, 8), reason: 'Cancelada', status: 'CANCELADA' });

    const datos = await panel();

    expect(datos.appointments.next).toEqual({
      id: expect.any(Number),
      scheduledAt: futureDateTime(1, 15),
      clientName: 'Luis Gómez',
      vehiclePlate: 'LGZ123',
      reason: 'Más cercana'
    });
  });
});

describe('mantenimientos', () => {
  async function mantenimiento(datos) {
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id, { currentMileage: 20000 });
    return createMaintenance(vehiculo.id, datos);
  }

  test('test_vencidos_y_proximos_coinciden_con_el_listado_de_avisos', async () => {
    await mantenimiento({ nextDate: fechaEn(-5), nextMileage: null });
    await mantenimiento({ nextDate: null, nextMileage: 19000 });
    await mantenimiento({ nextDate: fechaEn(10), nextMileage: null });
    await mantenimiento({ nextDate: null, nextMileage: 20500 });
    await mantenimiento({ nextDate: fechaEn(90), nextMileage: null });
    await mantenimiento({ nextDate: fechaEn(-5), nextMileage: null, status: 'REALIZADO' });

    const datos = await panel();

    expect(datos.maintenance).toEqual({ overdue: 2, upcoming: 2, warningDays: 30, warningKm: 1000 });
    const vencidos = await request(app).get('/api/maintenance').query({ filter: 'OVERDUE' }).set('Authorization', admin.auth);
    const proximos = await request(app).get('/api/maintenance').query({ filter: 'UPCOMING' }).set('Authorization', admin.auth);
    const alertas = await request(app).get('/api/maintenance').set('Authorization', admin.auth);
    expect(alertas.body.meta.total).toBe(datos.maintenance.overdue + datos.maintenance.upcoming);
    expect(vencidos.status).toBe(200);
    expect(proximos.status).toBe(200);
  });

  test('test_los_umbrales_cambian_el_resultado', async () => {
    await mantenimiento({ nextDate: fechaEn(45), nextMileage: null });
    const antes = await panel();

    await pool.query("UPDATE app_settings SET setting_value = '60' WHERE setting_key = 'maintenance_warning_days'");
    const despues = await panel();

    expect(antes.maintenance).toEqual(expect.objectContaining({ upcoming: 0, warningDays: 30 }));
    expect(despues.maintenance).toEqual(expect.objectContaining({ upcoming: 1, warningDays: 60 }));
  });
});

describe('inventario', () => {
  test('test_las_alertas_coinciden_con_las_de_refacciones', async () => {
    await createPart({ stock: 1, minimumStock: 2 });
    await createPart({ stock: 2, minimumStock: 2 });
    await createPart({ stock: 0, minimumStock: 2 });
    await createPart({ stock: 50, minimumStock: 2 });
    await createPart({ stock: 0, minimumStock: 2, active: 0 });

    const datos = await panel();
    const alertas = await request(app).get('/api/parts/alerts').set('Authorization', admin.auth);

    expect(datos.inventory.low).toBe(2);
    expect(datos.inventory.out).toBe(1);
    expect(alertas.body.data).toEqual(expect.objectContaining({ low: datos.inventory.low, out: datos.inventory.out }));
  });

  test('test_critical_trae_hasta_5_con_las_agotadas_primero', async () => {
    for (let i = 0; i < 4; i += 1) await createPart({ code: `BAJA-${i}`, stock: 1, minimumStock: 5 });
    for (let i = 0; i < 3; i += 1) await createPart({ code: `AGOT-${i}`, stock: 0, minimumStock: 5 });

    const datos = await panel();

    expect(datos.inventory.critical).toHaveLength(5);
    expect(datos.inventory.critical.slice(0, 3).map((p) => p.stockStatus)).toEqual(['OUT', 'OUT', 'OUT']);
    expect(datos.inventory.critical.slice(3).map((p) => p.stockStatus)).toEqual(['LOW', 'LOW']);
    expect(datos.inventory.critical[0]).toEqual({
      id: expect.any(Number),
      code: expect.any(String),
      name: expect.any(String),
      stock: 0,
      minimumStock: 5,
      stockStatus: 'OUT'
    });
  });
});

describe('pagos', () => {
  test('test_cobrado_hoy_suma_solo_aprobados_de_hoy_y_no_anulados', async () => {
    const a = await ordenCon('TERMINADO', 1000);
    const b = await ordenCon('ENTREGADO', 500);
    await createPayment(a.id, { amount: 300 });
    await createPayment(b.id, { amount: 200 });
    await createPayment(a.id, { amount: 100, status: 'ANULADO' });
    await createPayment(a.id, { amount: 50, status: 'CANCELADO' });
    const viejo = await createPayment(b.id, { amount: 150 });
    await pool.query('UPDATE payments SET created_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE id = ?', [viejo.id]);

    const datos = await panel();

    expect(datos.payments.collectedToday).toBe(500);
  });

  test('test_saldo_y_ordenes_por_cobrar_coinciden_con_los_saldos_de_las_ordenes', async () => {
    const sinPagar = await ordenCon('TERMINADO', 1000);
    const parcial = await ordenCon('ENTREGADO', 800);
    const pagada = await ordenCon('ENTREGADO', 400);
    await ordenCon('EN_REPARACION', 900);
    await ordenCon('TERMINADO', 0);
    await createPayment(parcial.id, { amount: 300 });
    await createPayment(pagada.id, { amount: 400 });

    const datos = await panel();

    expect(datos.payments.pendingBalance).toBe(1500);
    expect(datos.payments.ordersToCollect).toBe(2);
    const porCobrar = await request(app).get('/api/orders').query({ paymentStatus: 'DUE' }).set('Authorization', admin.auth);
    expect(porCobrar.body.meta.total).toBe(datos.payments.ordersToCollect);
    let saldos = 0;
    for (const o of porCobrar.body.data) {
      const detalle = await request(app).get(`/api/orders/${o.id}/payments`).set('Authorization', admin.auth);
      saldos += detalle.body.data.summary.balance;
    }
    expect(saldos).toBe(datos.payments.pendingBalance);
    expect(sinPagar.id).toBeDefined();
  });

  test('test_un_pago_pendiente_de_mercado_pago_no_baja_el_saldo_ni_cuenta_como_cobrado', async () => {
    const o = await ordenCon('TERMINADO', 1000);
    await createPayment(o.id, { method: 'MERCADO_PAGO', amount: 400, status: 'PENDIENTE' });

    const datos = await panel();

    expect(datos.payments).toEqual({ collectedToday: 0, pendingBalance: 1000, ordersToCollect: 1 });
  });

  test('test_un_pago_anulado_cambia_los_tres_importes', async () => {
    const o = await ordenCon('TERMINADO', 1000);
    const pago = await createPayment(o.id, { amount: 400 });
    const antes = await panel();

    await pool.query("UPDATE payments SET status = 'ANULADO', void_reason = 'Error', voided_by = ?, voided_at = NOW() WHERE id = ?", [
      admin.user.id,
      pago.id
    ]);
    const despues = await panel();

    expect(antes.payments).toEqual({ collectedToday: 400, pendingBalance: 600, ordersToCollect: 1 });
    expect(despues.payments).toEqual({ collectedToday: 0, pendingBalance: 1000, ordersToCollect: 1 });
  });

  test('test_registrar_un_pago_se_refleja_en_la_siguiente_consulta', async () => {
    const o = await ordenCon('TERMINADO', 1000);
    const antes = await panel();

    const res = await request(app)
      .post(`/api/orders/${o.id}/payments`)
      .set('Authorization', recepcion.auth)
      .send({ method: 'CASH', amount: 1000 });
    const despues = await panel();

    expect(res.status).toBe(201);
    expect(antes.payments).toEqual({ collectedToday: 0, pendingBalance: 1000, ordersToCollect: 1 });
    expect(despues.payments).toEqual({ collectedToday: 1000, pendingBalance: 0, ordersToCollect: 0 });
  });
});

describe('datos generales y permisos', () => {
  test('test_sin_datos_devuelve_ceros_y_generated_at_es_reciente', async () => {
    const antes = Date.now();

    const datos = await panel();

    expect(datos.orders).toEqual({ received: 0, diagnosis: 0, inRepair: 0, waitingPart: 0, finishedNotDelivered: 0, deliveredToday: 0 });
    expect(datos.appointments).toEqual({ today: 0, next7Days: 0, next: null });
    expect(datos.maintenance).toEqual({ overdue: 0, upcoming: 0, warningDays: 30, warningKm: 1000 });
    expect(datos.inventory).toEqual({ low: 0, out: 0, critical: [] });
    expect(datos.payments).toEqual({ collectedToday: 0, pendingBalance: 0, ordersToCollect: 0 });
    expect(Math.abs(Date.parse(datos.generatedAt) - antes)).toBeLessThan(10000);
  });

  test('test_solo_el_administrador_accede', async () => {
    await ordenCon('TERMINADO', 1000);

    const ok = await request(app).get('/api/dashboard').set('Authorization', admin.auth);
    const rec = await request(app).get('/api/dashboard').set('Authorization', recepcion.auth);
    const mec = await request(app).get('/api/dashboard').set('Authorization', mecanico.auth);
    const sin = await request(app).get('/api/dashboard');

    expect(ok.status).toBe(200);
    expect(rec.status).toBe(403);
    expect(mec.status).toBe(403);
    expect(sin.status).toBe(401);
    expect(rec.body.data).toBeUndefined();
    expect(JSON.stringify(mec.body)).not.toMatch(/pendingBalance|collectedToday/);
  });
});
