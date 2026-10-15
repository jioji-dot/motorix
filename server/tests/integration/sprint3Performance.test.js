// Prueba de rendimiento del Sprint 3 (SC-010) sobre `motorix_test`: con 5 000 refacciones y
// 1 000 servicios de un mismo vehículo, el inventario, las alertas, la búsqueda para órdenes y el
// historial responden en menos de 2 segundos.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMaintenance,
  createOrder,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();
const LIMITE_MS = 2000;
const REFACCIONES = 5000;
const SERVICIOS = 1000;

let admin;
let mecanico;
let recepcion;
let vehiculo;

/** Ejecuta varias sentencias con un límite de recursión alto para las series generadas. */
async function sembrarCargaMasiva() {
  const conexion = await pool.getConnection();
  try {
    await conexion.query('SET SESSION cte_max_recursion_depth = 20000');

    // 5 000 refacciones: ~10 % agotadas, ~10 % con stock bajo y el resto normales (con su entrada inicial).
    await conexion.query(
      `INSERT INTO parts (code, name, description, price, stock, minimum_stock, active)
       WITH RECURSIVE serie AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM serie WHERE n < ${REFACCIONES})
       SELECT CONCAT('PERF-', LPAD(n, 5, '0')), CONCAT('Refacción de rendimiento ', n),
              'Pieza generada para la prueba de carga', 10 + (n % 90),
              CASE WHEN n % 10 = 0 THEN 0 WHEN n % 10 = 1 THEN 2 ELSE 50 END, 5, 1
       FROM serie`
    );
    await conexion.query(
      `INSERT INTO inventory_movements (part_id, type, quantity, reason, created_by)
       SELECT p.id, 'IN', p.stock, 'Existencia inicial', ? FROM parts p WHERE p.stock > 0`,
      [admin.user.id]
    );

    // 1 000 servicios terminados del mismo vehículo, con historial de estados y una línea de servicio.
    await conexion.query(
      `INSERT INTO service_orders
         (client_id, vehicle_id, mechanic_id, entry_mileage, service_mileage, reported_problem,
          diagnosis, status, created_by, created_at)
       WITH RECURSIVE serie AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM serie WHERE n < ${SERVICIOS})
       SELECT ?, ?, ?, 1000 + n * 10, 1005 + n * 10, CONCAT('Servicio de rendimiento ', n),
              'Diagnóstico de la prueba de carga', 'ENTREGADO', ?, DATE_SUB(NOW(), INTERVAL n HOUR)
       FROM serie`,
      [vehiculo.clientId, vehiculo.id, mecanico.user.id, recepcion.user.id]
    );
    await conexion.query(
      "UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL"
    );
    await conexion.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, created_at)
       SELECT o.id, 'EN_REPARACION', 'TERMINADO', ?, DATE_ADD(o.created_at, INTERVAL 5 HOUR)
       FROM service_orders o WHERE o.vehicle_id = ?`,
      [mecanico.user.id, vehiculo.id]
    );
    await conexion.query(
      `INSERT INTO order_services (order_id, description, amount)
       SELECT o.id, 'Servicio de prueba de carga', 100 FROM service_orders o WHERE o.vehicle_id = ?`,
      [vehiculo.id]
    );
    await conexion.query(
      `INSERT INTO order_parts (order_id, part_id, quantity, unit_price)
       SELECT o.id, (o.id % ${REFACCIONES}) + 1, 1, 50 FROM service_orders o WHERE o.vehicle_id = ?`,
      [vehiculo.id]
    );
  } finally {
    conexion.release();
  }
}

/** Mide una petición GET y comprueba que responda en el tiempo límite. */
async function medir(auth, ruta) {
  await request(app).get(ruta).set('Authorization', auth); // calentamiento
  const inicio = performance.now();
  const res = await request(app).get(ruta).set('Authorization', auth);
  const duracion = performance.now() - inicio;
  expect(res.status).toBe(200);
  return { res, duracion };
}

beforeAll(async () => {
  await cleanTables();
  admin = await createAuthenticated('ADMIN');
  mecanico = await createAuthenticated('MECHANIC');
  recepcion = await createAuthenticated('RECEPTIONIST');
  const cliente = await createClient();
  vehiculo = await createVehicle(cliente.id, { currentMileage: 20000 });
  await sembrarCargaMasiva();
  // Algunos mantenimientos para el listado de avisos.
  for (let i = 0; i < 21; i += 1) {
    const otroCliente = await createClient();
    const otro = await createVehicle(otroCliente.id, { currentMileage: 1000 });
    await createMaintenance(otro.id, { nextMileage: 900 + i });
  }
}, 180000);

afterAll(async () => {
  await cleanTables();
  await closePool();
});

describe('rendimiento con 5 000 refacciones y 1 000 servicios', () => {
  test('test_se_generaron_los_datos_de_carga', async () => {
    const [[{ partes }]] = await pool.query('SELECT COUNT(*) AS partes FROM parts');
    const [[{ servicios }]] = await pool.query(
      "SELECT COUNT(*) AS servicios FROM service_orders WHERE status = 'ENTREGADO'"
    );

    expect(partes).toBe(REFACCIONES);
    expect(servicios).toBe(SERVICIOS);
  });

  test('test_el_listado_del_inventario_responde_en_menos_de_2_segundos', async () => {
    const { res, duracion } = await medir(admin.auth, '/api/parts');

    expect(res.body.meta.total).toBe(REFACCIONES);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_la_busqueda_por_nombre_o_codigo_responde_en_menos_de_2_segundos', async () => {
    const porNombre = await medir(admin.auth, '/api/parts?search=rendimiento%20123');
    const porCodigo = await medir(admin.auth, '/api/parts?search=PERF-0450');

    expect(porNombre.res.body.data.length).toBeGreaterThan(0);
    expect(porCodigo.res.body.data.length).toBeGreaterThan(0);
    expect(porNombre.duracion).toBeLessThan(LIMITE_MS);
    expect(porCodigo.duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_las_alertas_y_su_filtro_responden_en_menos_de_2_segundos', async () => {
    const resumen = await medir(admin.auth, '/api/parts/alerts');
    const filtro = await medir(admin.auth, '/api/parts?alert=ANY&pageSize=100');

    expect(resumen.res.body.data.total).toBe(REFACCIONES / 5);
    expect(filtro.res.body.meta.total).toBe(REFACCIONES / 5);
    expect(resumen.duracion).toBeLessThan(LIMITE_MS);
    expect(filtro.duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_la_busqueda_de_refacciones_disponibles_para_una_orden_responde_en_menos_de_2_segundos', async () => {
    const { res, duracion } = await medir(mecanico.auth, '/api/parts/available?search=perf-00');

    expect(res.body.data).toHaveLength(20);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_el_historial_de_1000_servicios_responde_en_menos_de_2_segundos_en_la_primera_y_la_ultima_pagina', async () => {
    const primera = await medir(mecanico.auth, `/api/vehicles/${vehiculo.id}/history?page=1&pageSize=20`);
    const ultima = await medir(mecanico.auth, `/api/vehicles/${vehiculo.id}/history?page=50&pageSize=20`);

    expect(primera.res.body.meta.total).toBe(SERVICIOS);
    expect(primera.res.body.data).toHaveLength(20);
    expect(ultima.res.body.data).toHaveLength(20);
    expect(primera.duracion).toBeLessThan(LIMITE_MS);
    expect(ultima.duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_el_historial_trae_las_refacciones_de_cada_servicio', async () => {
    const { res } = await medir(mecanico.auth, `/api/vehicles/${vehiculo.id}/history?page=1&pageSize=100`);

    expect(res.body.data).toHaveLength(100);
    for (const entrada of res.body.data) {
      expect(entrada.parts).toHaveLength(1);
      expect(entrada.services).toHaveLength(1);
      expect(entrada.total).toBe(150);
    }
  });

  test('test_el_listado_de_mantenimientos_para_avisar_responde_en_menos_de_2_segundos', async () => {
    const { res, duracion } = await medir(recepcion.auth, '/api/maintenance?pageSize=100');

    expect(res.body.meta.total).toBe(21);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });

  test('test_agregar_una_refaccion_a_una_orden_con_5000_refacciones_responde_en_menos_de_2_segundos', async () => {
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });
    const [[pieza]] = await pool.query("SELECT id FROM parts WHERE code = 'PERF-00002'");

    const inicio = performance.now();
    const res = await request(app)
      .post(`/api/orders/${orden.id}/parts`)
      .set('Authorization', mecanico.auth)
      .send({ partId: pieza.id, quantity: 1 });
    const duracion = performance.now() - inicio;

    expect(res.status).toBe(200);
    expect(duracion).toBeLessThan(LIMITE_MS);
  });
});
