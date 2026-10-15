// Pruebas de integración del historial del vehículo (US1) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMechanic,
  createOrder,
  createOrderLabor,
  createOrderPart,
  createOrderService,
  createPart,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const historial = (auth, vehicleId, consulta = '') =>
  request(app).get(`/api/vehicles/${vehicleId}/history${consulta}`).set('Authorization', auth);

/** Fija la fecha en que la orden pasó a TERMINADO (UTC). */
const fijarFechaDeServicio = (orderId, fecha) =>
  pool.query("UPDATE order_status_history SET created_at = ? WHERE order_id = ? AND to_status = 'TERMINADO'", [
    fecha,
    orderId
  ]);

let auth;
let cliente;
let vehiculo;

beforeEach(async () => {
  await cleanTables();
  ({ auth } = await createAuthenticated('MECHANIC'));
  cliente = await createClient();
  vehiculo = await createVehicle(cliente.id);
});
afterAll(closePool);

const ordenDelVehiculo = (extra = {}) =>
  createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, ...extra });

describe('contenido del historial', () => {
  test('test_solo_incluye_ordenes_terminadas_y_entregadas', async () => {
    const terminada = await ordenDelVehiculo({ status: 'TERMINADO' });
    const entregada = await ordenDelVehiculo({ status: 'ENTREGADO' });
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']) {
      await ordenDelVehiculo({ status });
    }

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data.map((o) => o.orderId).sort()).toEqual([terminada.id, entregada.id].sort());
    expect(res.body.meta.total).toBe(2);
  });

  test('test_solo_incluye_las_ordenes_del_vehiculo_consultado', async () => {
    const otro = await createVehicle(cliente.id);
    const propia = await ordenDelVehiculo({ status: 'ENTREGADO' });
    await createOrder({ clientId: cliente.id, vehicleId: otro.id, status: 'ENTREGADO' });

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data.map((o) => o.orderId)).toEqual([propia.id]);
  });

  test('test_ordena_de_la_mas_reciente_a_la_mas_antigua_por_fecha_de_servicio', async () => {
    const a = await ordenDelVehiculo({ status: 'ENTREGADO' });
    const b = await ordenDelVehiculo({ status: 'ENTREGADO' });
    const c = await ordenDelVehiculo({ status: 'TERMINADO' });
    // El orden de creación (a, b, c) no coincide con el de servicio: b, c, a.
    await fijarFechaDeServicio(a.id, '2026-03-01 10:00:00');
    await fijarFechaDeServicio(b.id, '2026-09-01 10:00:00');
    await fijarFechaDeServicio(c.id, '2026-06-01 10:00:00');

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data.map((o) => o.orderId)).toEqual([b.id, c.id, a.id]);
    expect(res.body.data[0].serviceDate).toBe('2026-09-01T10:00:00.000Z');
  });

  test('test_con_la_misma_fecha_desempata_por_identificador_descendente', async () => {
    const a = await ordenDelVehiculo({ status: 'ENTREGADO' });
    const b = await ordenDelVehiculo({ status: 'ENTREGADO' });
    await fijarFechaDeServicio(a.id, '2026-05-01 10:00:00');
    await fijarFechaDeServicio(b.id, '2026-05-01 10:00:00');

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data.map((o) => o.orderId)).toEqual([b.id, a.id]);
  });

  test('test_sin_cambio_a_terminado_en_el_historial_de_estados_usa_la_fecha_de_creacion', async () => {
    const orden = await ordenDelVehiculo({ status: 'ENTREGADO' });
    await pool.query('DELETE FROM order_status_history WHERE order_id = ?', [orden.id]);
    await pool.query("UPDATE service_orders SET created_at = '2026-02-02 08:00:00' WHERE id = ?", [orden.id]);

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data[0].serviceDate).toBe('2026-02-02T08:00:00.000Z');
  });

  test('test_el_kilometraje_es_el_de_servicio_o_el_de_entrada_si_no_se_capturo', async () => {
    const conServicio = await ordenDelVehiculo({ status: 'ENTREGADO', entryMileage: 20000 });
    const sinServicio = await ordenDelVehiculo({ status: 'ENTREGADO', entryMileage: 15000 });
    await pool.query('UPDATE service_orders SET service_mileage = 20350 WHERE id = ?', [conServicio.id]);
    await fijarFechaDeServicio(conServicio.id, '2026-09-01 10:00:00');
    await fijarFechaDeServicio(sinServicio.id, '2026-04-01 10:00:00');

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data.map((o) => o.mileage)).toEqual([20350, 15000]);
  });

  test('test_incluye_servicios_mano_de_obra_refacciones_diagnostico_recomendaciones_y_total', async () => {
    const mecanico = await createMechanic({ name: 'Mario Mecánico' });
    const orden = await ordenDelVehiculo({
      status: 'ENTREGADO',
      mechanicId: mecanico.id,
      diagnosis: 'Balatas gastadas',
      recommendations: 'Revisar llantas en 5,000 km'
    });
    await createOrderService(orden.id, { description: 'Cambio de balatas', amount: 500.5 });
    await createOrderLabor(orden.id, { description: 'Montaje', hours: 1.5, hourlyRate: 200 });
    const pieza = await createPart({ code: 'BAL-01', name: 'Balatas' });
    await createOrderPart(orden.id, pieza.id, { quantity: 2, unitPrice: 99.99 });

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        mechanicName: 'Mario Mecánico',
        diagnosis: 'Balatas gastadas',
        recommendations: 'Revisar llantas en 5,000 km',
        services: [{ description: 'Cambio de balatas', amount: 500.5 }],
        labor: [{ description: 'Montaje', hours: 1.5, hourlyRate: 200, amount: 300 }],
        parts: [{ code: 'BAL-01', name: 'Balatas', quantity: 2, unitPrice: 99.99, amount: 199.98 }],
        total: 1000.48
      })
    );
  });

  test('test_una_orden_sin_mecanico_muestra_mechanicName_nulo', async () => {
    await ordenDelVehiculo({ status: 'ENTREGADO' });

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data[0].mechanicName).toBeNull();
  });
});

describe('derivación sin duplicados', () => {
  test('test_un_servicio_recien_terminado_aparece_sin_capturarlo_de_nuevo', async () => {
    const orden = await ordenDelVehiculo({ status: 'EN_REPARACION', mechanicId: (await createMechanic()).id });
    await createOrderService(orden.id, { description: 'Servicio', amount: 100 });
    expect((await historial(auth, vehiculo.id)).body.data).toEqual([]);

    // Terminar la orden por la API del Sprint 2 (diagnóstico y servicio ya capturados).
    const admin = await createAuthenticated('ADMIN');
    await pool.query("UPDATE service_orders SET diagnosis = 'Listo' WHERE id = ?", [orden.id]);
    const terminar = await request(app)
      .post(`/api/orders/${orden.id}/status`)
      .set('Authorization', admin.auth)
      .send({ status: 'TERMINADO' });
    expect(terminar.status).toBe(200);

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toEqual(expect.objectContaining({ orderId: orden.id, status: 'TERMINADO' }));
  });

  test('test_el_historial_refleja_el_estado_actual_de_la_orden_sin_duplicados', async () => {
    const orden = await ordenDelVehiculo({ status: 'TERMINADO' });
    const servicio = await createOrderService(orden.id, { amount: 100 });

    const antes = await historial(auth, vehiculo.id);
    await pool.query('UPDATE order_services SET amount = 250 WHERE id = ?', [servicio.id]);
    await pool.query("UPDATE service_orders SET status = 'ENTREGADO' WHERE id = ?", [orden.id]);
    const despues = await historial(auth, vehiculo.id);

    expect(antes.body.data[0].total).toBe(100);
    expect(despues.body.data).toHaveLength(1);
    expect(despues.body.data[0]).toEqual(expect.objectContaining({ status: 'ENTREGADO', total: 250 }));
  });

  test('test_no_existe_ninguna_tabla_de_historial_del_vehiculo', async () => {
    const [tablas] = await pool.query(
      "SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE '%history%'"
    );

    expect(tablas.map((t) => t.nombre || t.NOMBRE || t.TABLE_NAME)).toEqual(['order_status_history']);
  });

  test('test_una_orden_terminada_dos_veces_en_el_historial_usa_la_fecha_mas_reciente_y_aparece_una_vez', async () => {
    const orden = await ordenDelVehiculo({ status: 'TERMINADO' });
    await pool.query(
      "INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, created_at) VALUES (?, 'EN_REPARACION', 'TERMINADO', ?, '2030-01-01 00:00:00')",
      [orden.id, orden.createdBy]
    );

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].serviceDate).toBe('2030-01-01T00:00:00.000Z');
  });
});

describe('vacío, errores y permisos', () => {
  test('test_un_vehiculo_sin_servicios_devuelve_data_vacia', async () => {
    const res = await historial(auth, vehiculo.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('test_un_vehiculo_inexistente_responde_404', async () => {
    expect((await historial(auth, 9999)).status).toBe(404);
  });

  test('test_un_identificador_invalido_responde_400', async () => {
    expect((await historial(auth, 'abc')).status).toBe(400);
  });

  test.each(['ADMIN', 'RECEPTIONIST', 'MECHANIC'])('test_%s_puede_consultar_el_historial', async (rol) => {
    const { auth: otro } = await createAuthenticated(rol);
    await ordenDelVehiculo({ status: 'ENTREGADO' });

    const res = await historial(otro, vehiculo.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('test_un_mecanico_ve_el_historial_de_un_vehiculo_aunque_no_sea_de_sus_ordenes', async () => {
    const otroMecanico = await createMechanic();
    await ordenDelVehiculo({ status: 'ENTREGADO', mechanicId: otroMecanico.id });

    const res = await historial(auth, vehiculo.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('test_el_historial_es_de_solo_lectura', async () => {
    const orden = await ordenDelVehiculo({ status: 'ENTREGADO' });

    const intentos = await Promise.all([
      request(app).post(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', auth).send({}),
      request(app).patch(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', auth).send({}),
      request(app).delete(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', auth)
    ]);

    for (const res of intentos) expect([404, 405]).toContain(res.status);
    const [[fila]] = await pool.query('SELECT status FROM service_orders WHERE id = ?', [orden.id]);
    expect(fila.status).toBe('ENTREGADO');
  });

  test('test_sin_token_responde_401', async () => {
    const res = await request(app).get(`/api/vehicles/${vehiculo.id}/history`);

    expect(res.status).toBe(401);
  });
});

describe('paginación', () => {
  test('test_pagina_el_historial_manteniendo_el_orden_cronologico', async () => {
    const ids = [];
    for (let i = 1; i <= 5; i += 1) {
      const orden = await ordenDelVehiculo({ status: 'ENTREGADO' });
      await fijarFechaDeServicio(orden.id, `2026-0${i}-01 10:00:00`);
      ids.push(orden.id);
    }

    const primera = await historial(auth, vehiculo.id, '?page=1&pageSize=2');
    const tercera = await historial(auth, vehiculo.id, '?page=3&pageSize=2');

    expect(primera.body.data.map((o) => o.orderId)).toEqual([ids[4], ids[3]]);
    expect(tercera.body.data.map((o) => o.orderId)).toEqual([ids[0]]);
    expect(primera.body.meta).toEqual({ page: 1, pageSize: 2, total: 5 });
  });

  test('test_los_detalles_de_cada_pagina_corresponden_a_sus_ordenes', async () => {
    const a = await ordenDelVehiculo({ status: 'ENTREGADO' });
    const b = await ordenDelVehiculo({ status: 'ENTREGADO' });
    await fijarFechaDeServicio(a.id, '2026-01-01 10:00:00');
    await fijarFechaDeServicio(b.id, '2026-02-01 10:00:00');
    await createOrderService(a.id, { description: 'Servicio de A', amount: 10 });
    await createOrderService(b.id, { description: 'Servicio de B', amount: 20 });

    const res = await historial(auth, vehiculo.id);

    expect(res.body.data.map((o) => o.services.map((s) => s.description))).toEqual([
      ['Servicio de B'],
      ['Servicio de A']
    ]);
  });
});
