// Prueba de rendimiento del Sprint 4 (SC-007) sobre `motorix_test`: con 1 000 órdenes, 1 000 citas,
// 5 000 refacciones y 5 000 pagos, el panel, el listado de pagos (con filtros y búsqueda) y el de
// tickets responden en menos de 2 segundos.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createAuthenticated, createClient, createVehicle } from '../helpers/factories.js';

const app = createApp();
const LIMITE_MS = 2000;
const ORDENES = 1000;
const CITAS = 1000;
const REFACCIONES = 5000;
const PAGOS = 5000;

let admin;
let recepcion;
let cliente;
let vehiculo;

async function sembrarCargaMasiva() {
  const conexion = await pool.getConnection();
  try {
    await conexion.query('SET SESSION cte_max_recursion_depth = 20000');

    // 1 000 órdenes terminadas o entregadas con un servicio de $100 cada una.
    await conexion.query(
      `INSERT INTO service_orders
         (client_id, vehicle_id, entry_mileage, reported_problem, status, created_by, delivered_at, created_at)
       WITH RECURSIVE serie AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM serie WHERE n < ${ORDENES})
       SELECT ?, ?, 1000 + n, CONCAT('Servicio de rendimiento ', n),
              IF(n % 2 = 0, 'ENTREGADO', 'TERMINADO'), ?,
              IF(n % 2 = 0, DATE_SUB(NOW(), INTERVAL n HOUR), NULL), DATE_SUB(NOW(), INTERVAL n HOUR)
       FROM serie`,
      [cliente.id, vehiculo.id, recepcion.user.id]
    );
    await conexion.query("UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL");
    await conexion.query(
      `INSERT INTO order_services (order_id, description, amount)
       SELECT id, 'Servicio de prueba de carga', 100 FROM service_orders`
    );

    // 1 000 citas pendientes repartidas en los próximos días.
    await conexion.query(
      `INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, status, created_by)
       WITH RECURSIVE serie AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM serie WHERE n < ${CITAS})
       SELECT ?, ?, DATE_ADD(NOW(), INTERVAL n HOUR), CONCAT('Cita de rendimiento ', n),
              IF(n % 3 = 0, 'CONFIRMADA', 'PENDIENTE'), ?
       FROM serie`,
      [cliente.id, vehiculo.id, recepcion.user.id]
    );

    // 5 000 refacciones (10 % agotadas, 10 % con stock bajo).
    await conexion.query(
      `INSERT INTO parts (code, name, description, price, stock, minimum_stock, active)
       WITH RECURSIVE serie AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM serie WHERE n < ${REFACCIONES})
       SELECT CONCAT('PERF-', LPAD(n, 5, '0')), CONCAT('Refacción de rendimiento ', n),
              'Pieza generada para la prueba de carga', 10 + (n % 90),
              CASE WHEN n % 10 = 0 THEN 0 WHEN n % 10 = 1 THEN 2 ELSE 50 END, 5, 1
       FROM serie`
    );

    // 5 000 pagos de $1: cinco por orden, de los cuatro estados con efecto y de los tres métodos manuales.
    await conexion.query(
      `INSERT INTO payments (order_id, method, amount, status, reference, void_reason, voided_by, voided_at, created_by, created_at)
       WITH RECURSIVE serie AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM serie WHERE n < ${PAGOS})
       SELECT (SELECT MIN(id) FROM service_orders) + (n % ${ORDENES}),
              ELT(1 + (n % 3), 'CASH', 'CARD', 'TRANSFER'), 1.00,
              IF(n % 20 = 0, 'ANULADO', 'APROBADO'),
              IF(n % 3 = 0, NULL, CONCAT('REF-', n)),
              IF(n % 20 = 0, 'Prueba de carga', NULL), IF(n % 20 = 0, ?, NULL), IF(n % 20 = 0, NOW(), NULL),
              ?, DATE_SUB(NOW(), INTERVAL (n % 500) HOUR)
       FROM serie`,
      [admin.user.id, recepcion.user.id]
    );

    // Tickets para la mitad de las órdenes.
    await conexion.query(
      `INSERT INTO tickets (order_id, generated_by)
       SELECT id, ? FROM service_orders WHERE id % 2 = 0`,
      [recepcion.user.id]
    );
    await conexion.query("UPDATE tickets SET folio = CONCAT('TK-', LPAD(id, 6, '0')) WHERE folio IS NULL");

    // Tras una carga masiva MySQL aún no actualiza las estadísticas de los índices (lo hace solo con
    // el uso normal); se recalculan para medir el rendimiento en régimen estable.
    await conexion.query('ANALYZE TABLE payments, service_orders, order_services, tickets, appointments, parts');
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
  recepcion = await createAuthenticated('RECEPTIONIST');
  cliente = await createClient({ name: 'Cliente de rendimiento' });
  vehiculo = await createVehicle(cliente.id, { licensePlate: 'PERF123' });
  await sembrarCargaMasiva();
}, 240000);

afterAll(async () => {
  await cleanTables();
  await closePool();
});

describe('rendimiento con 1 000 órdenes, 1 000 citas, 5 000 refacciones y 5 000 pagos', () => {
  test('test_se_generaron_los_datos_de_carga', async () => {
    const contar = async (tabla) => Number((await pool.query(`SELECT COUNT(*) AS n FROM ${tabla}`))[0][0].n);

    expect(await contar('service_orders')).toBe(ORDENES);
    expect(await contar('appointments')).toBe(CITAS);
    expect(await contar('parts')).toBe(REFACCIONES);
    expect(await contar('payments')).toBe(PAGOS);
  });

  test('test_el_panel_responde_en_menos_de_2_segundos', async () => {
    const { res, duracion } = await medir(admin.auth, '/api/dashboard');

    expect(duracion).toBeLessThan(LIMITE_MS);
    expect(res.body.data.payments.ordersToCollect).toBeGreaterThan(0);
    expect(res.body.data.inventory.critical).toHaveLength(5);
  });

  test('test_el_listado_de_pagos_responde_en_menos_de_2_segundos', async () => {
    const { res, duracion } = await medir(recepcion.auth, '/api/payments');

    expect(duracion).toBeLessThan(LIMITE_MS);
    expect(res.body.meta.total).toBe(PAGOS);
  });

  test('test_el_listado_de_pagos_con_filtros_y_busqueda_responde_en_menos_de_2_segundos', async () => {
    const hoy = new Date();
    const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const filtros = [
      '/api/payments?status=APROBADO&method=CARD',
      `/api/payments?from=${dia}&to=${dia}`,
      '/api/payments?search=PERF123',
      '/api/payments?search=Cliente%20de%20rendimiento&status=ANULADO',
      '/api/payments?search=OS-00050'
    ];
    for (const ruta of filtros) {
      const { duracion } = await medir(recepcion.auth, ruta);
      expect(duracion).toBeLessThan(LIMITE_MS);
    }
  });

  test('test_el_listado_de_tickets_responde_en_menos_de_2_segundos', async () => {
    const { res, duracion } = await medir(recepcion.auth, '/api/tickets');
    const busqueda = await medir(recepcion.auth, '/api/tickets?search=PERF123');

    expect(duracion).toBeLessThan(LIMITE_MS);
    expect(busqueda.duracion).toBeLessThan(LIMITE_MS);
    expect(res.body.meta.total).toBe(ORDENES / 2);
  });

  test('test_el_listado_de_ordenes_por_cobrar_responde_en_menos_de_2_segundos', async () => {
    const { duracion } = await medir(recepcion.auth, '/api/orders?paymentStatus=DUE');

    expect(duracion).toBeLessThan(LIMITE_MS);
  });
});
