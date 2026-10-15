// SC-009: los listados de citas y órdenes responden en menos de 2 segundos con 1 000 registros de cada tipo.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMechanic,
  createVehicle,
  futureDateTime
} from '../helpers/factories.js';

const app = createApp();
const TOTAL = 1000;
const LIMITE_MS = 2000;
const ESTADOS = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO', 'ENTREGADO'];

let recepcion;
let mecanico;
let mecanicoAuth;
let dia;

async function medir(auth, ruta) {
  const inicio = Date.now();
  const res = await request(app).get(ruta).set('Authorization', auth);
  return { res, ms: Date.now() - inicio };
}

beforeAll(async () => {
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  const m = await createAuthenticated('MECHANIC');
  mecanico = m.user;
  mecanicoAuth = m.auth;
  const otro = await createMechanic();
  const cliente = await createClient({ name: 'Cliente de rendimiento' });
  const auto = await createVehicle(cliente.id, { licensePlate: 'PERF001' });
  dia = futureDateTime(30).slice(0, 10);

  const ordenes = [];
  const citas = [];
  for (let i = 0; i < TOTAL; i += 1) {
    ordenes.push([
      cliente.id,
      auto.id,
      i % 2 === 0 ? mecanico.id : otro.id,
      1000 + i,
      `Problema reportado número ${i}`,
      ESTADOS[i % ESTADOS.length],
      recepcion.user.id
    ]);
    citas.push([cliente.id, auto.id, `${dia} ${String(8 + (i % 10)).padStart(2, '0')}:00:00`, `Motivo ${i}`, recepcion.user.id]);
  }
  await pool.query(
    `INSERT INTO service_orders (client_id, vehicle_id, mechanic_id, entry_mileage, reported_problem, status, created_by)
     VALUES ?`,
    [ordenes]
  );
  await pool.query('UPDATE service_orders SET folio = CONCAT(\'OS-\', LPAD(id, 6, \'0\'))');
  await pool.query('INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, created_by) VALUES ?', [citas]);
  await pool.query(
    `INSERT INTO order_services (order_id, description, amount)
     SELECT id, 'Servicio de prueba', 100 FROM service_orders`
  );
}, 120000);

afterAll(async () => {
  await cleanTables();
  await closePool();
});

describe('rendimiento de los listados con 1 000 órdenes y 1 000 citas', () => {
  test('test_el_listado_de_ordenes_de_recepcion_responde_en_menos_de_2_segundos', async () => {
    const { res, ms } = await medir(recepcion.auth, '/api/orders?pageSize=100');

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(TOTAL);
    expect(res.body.data).toHaveLength(100);
    expect(res.body.data[0].total).toBe(100);
    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test('test_los_filtros_de_ordenes_responden_en_menos_de_2_segundos', async () => {
    for (const ruta of [
      '/api/orders?status=EN_REPARACION',
      `/api/orders?mechanicId=${mecanico.id}&pageSize=50`,
      '/api/orders?search=OS-000500',
      '/api/orders?search=PERF001&page=5&pageSize=100',
      '/api/orders?search=rendimiento'
    ]) {
      const { res, ms } = await medir(recepcion.auth, ruta);
      expect(res.status).toBe(200);
      expect(ms).toBeLessThan(LIMITE_MS);
    }
  });

  test('test_el_listado_del_mecanico_con_abiertas_primero_responde_en_menos_de_2_segundos', async () => {
    const { res, ms } = await medir(mecanicoAuth, '/api/orders?pageSize=100');

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(TOTAL / 2);
    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test('test_el_detalle_de_una_orden_responde_en_menos_de_2_segundos', async () => {
    const [[orden]] = await pool.query('SELECT id FROM service_orders ORDER BY id LIMIT 1 OFFSET 500');

    const { res, ms } = await medir(recepcion.auth, `/api/orders/${orden.id}`);

    expect(res.status).toBe(200);
    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test('test_los_listados_de_citas_responden_en_menos_de_2_segundos', async () => {
    for (const ruta of [
      '/api/appointments?pageSize=100',
      `/api/appointments?date=${dia}&pageSize=100`,
      `/api/appointments?from=${dia}&to=${dia}&status=PENDIENTE`,
      '/api/appointments?search=PERF001&page=3&pageSize=100',
      '/api/appointments?search=rendimiento'
    ]) {
      const { res, ms } = await medir(recepcion.auth, ruta);
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(TOTAL);
      expect(ms).toBeLessThan(LIMITE_MS);
    }
  });
});
