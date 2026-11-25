// Rendimiento de la consulta de avisos, que la aplicación repite cada 60 segundos (FR-022, SC-003).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { aceptarTerminosDeTodos, aplicarSeeds, cerrarConexiones, crearClienteConVehiculo, crearUsuariosDePrueba, emitirToken, limpiarBase } from '../helpers.js';

const consultar = async (token) => {
  const inicio = process.hrtime.bigint();
  const r = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
  return { r, ms: Number(process.hrtime.bigint() - inicio) / 1e6 };
};

afterAll(cerrarConexiones);

test('con_los_datos_de_ejemplo_responde_en_menos_de_1_segundo', async () => {
  await limpiarBase();
  aplicarSeeds();
  await aceptarTerminosDeTodos(); // los seeds publican los términos (Sprint 7)
  const [[{ id }]] = await pool.query("SELECT id FROM users WHERE username = 'admin'");
  const token = emitirToken(id);
  await consultar(token); // calentamiento de la conexión
  const { r, ms } = await consultar(token);
  expect(r.status).toBe(200);
  expect(ms).toBeLessThan(1000);
}, 120000);

test('con_500_mantenimientos_500_refacciones_y_500_ordenes_abiertas_responde_en_menos_de_3_segundos', async () => {
  await limpiarBase();
  const usuarios = await crearUsuariosDePrueba();
  const vehiculos = [];
  for (let i = 0; i < 50; i += 1) vehiculos.push(await crearClienteConVehiculo({ km: 40000 }));

  const mantenimientos = Array.from({ length: 500 }, (_, i) => [
    vehiculos[i % 50].vehicleId, `Servicio ${i}`, '2026-01-01', 30000, i % 2 === 0 ? '2026-11-01' : null, i % 2 === 0 ? null : 39000, usuarios.ADMIN.id,
  ]);
  await pool.query(
    'INSERT INTO maintenance (vehicleId, serviceType, lastServiceDate, lastMileage, nextDate, nextMileage, createdBy) VALUES ?',
    [mantenimientos],
  );

  const refacciones = Array.from({ length: 500 }, (_, i) => [`PERF-${i}`, `Refacción ${i}`, 'Pruebas', 'Marca', i % 2, 3, 10, 20, 1]);
  await pool.query(
    'INSERT INTO parts (code, name, category, brand, stock, minimumStock, purchasePrice, salePrice, active) VALUES ?',
    [refacciones],
  );

  const ordenes = Array.from({ length: 500 }, (_, i) => [
    vehiculos[i % 50].clientId, vehiculos[i % 50].vehicleId, usuarios.MECHANIC.id, 40000, 'PERF', 'EN_REPARACION', usuarios.ADMIN.id, `OS-P${String(i).padStart(5, '0')}`,
  ]);
  await pool.query(
    'INSERT INTO service_orders (clientId, vehicleId, mechanicId, entryMileage, reportedProblem, status, createdBy, folio) VALUES ?',
    [ordenes],
  );
  await pool.query(
    `INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy, changedAt)
     SELECT id, NULL, 'EN_REPARACION', createdBy, DATE_SUB(NOW(), INTERVAL 6 DAY) FROM service_orders WHERE reportedProblem = 'PERF'`,
  );

  await consultar(usuarios.ADMIN.token); // calentamiento
  const { r, ms } = await consultar(usuarios.ADMIN.token);
  expect(r.status).toBe(200);
  expect(r.body.data.total).toBeGreaterThanOrEqual(1000);
  expect(r.body.data.groups.every((g) => g.items.length <= 10)).toBe(true);
  expect(ms).toBeLessThan(3000);

  const mecanico = await consultar(usuarios.MECHANIC.token);
  expect(mecanico.ms).toBeLessThan(3000);
}, 180000);
