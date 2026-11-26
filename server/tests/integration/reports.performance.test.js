// Rendimiento de los reportes con un año de datos (Sprint 7, FR-014, SC-003).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearClienteConVehiculo, crearRefaccion, crearUsuariosDePrueba, fechaDia, limpiarBase } from '../helpers.js';

const REPORTES = ['income', 'services', 'productivity', 'parts', 'rotation'];
let admin;

beforeAll(async () => {
  await limpiarBase();
  const usuarios = await crearUsuariosDePrueba();
  admin = usuarios.ADMIN;
  const c = await crearClienteConVehiculo();
  const piezas = [];
  for (let i = 0; i < 20; i += 1) piezas.push(await crearRefaccion({ stock: 50, minimumStock: 2, purchasePrice: 10 + i, salePrice: 30 + i }));

  const N = 3000;
  const ordenes = Array.from({ length: N }, (_, i) => [c.clientId, c.vehicleId, usuarios.MECHANIC.id, 1000, 'PERF', 'ENTREGADO', admin.id, `OS-R${String(i).padStart(5, '0')}`]);
  await pool.query('INSERT INTO service_orders (clientId, vehicleId, mechanicId, entryMileage, reportedProblem, status, createdBy, folio) VALUES ?', [ordenes]);
  // Cada orden se terminó en un día de los últimos 365, con un servicio, mano de obra, una refacción, un pago y una salida de inventario.
  await pool.query(
    `INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy, changedAt)
     SELECT id, 'EN_REPARACION', 'TERMINADO', createdBy, DATE_SUB(NOW(), INTERVAL (id % 365) DAY) FROM service_orders WHERE reportedProblem = 'PERF'`,
  );
  await pool.query("INSERT INTO order_services (orderId, description, amount) SELECT id, CONCAT('Servicio ', id % 40), 100 FROM service_orders WHERE reportedProblem = 'PERF'");
  await pool.query("INSERT INTO order_labor (orderId, description, hours, hourlyRate) SELECT id, 'Mano de obra', 1, 200 FROM service_orders WHERE reportedProblem = 'PERF'");
  const ids = piezas.map((p) => p.id);
  await pool.query(
    `INSERT INTO order_parts (orderId, partId, partCode, partName, quantity, unitPrice)
     SELECT o.id, p.id, p.code, p.name, 1, p.salePrice FROM service_orders o JOIN parts p ON p.id = ELT(1 + (o.id % ${ids.length}), ${ids.join(',')})
      WHERE o.reportedProblem = 'PERF'`,
  );
  await pool.query(
    `INSERT INTO payments (orderId, amount, method, status, paidAt, createdBy)
     SELECT id, 300, 'EFECTIVO', 'PAGADO', DATE_SUB(NOW(), INTERVAL (id % 365) DAY), createdBy FROM service_orders WHERE reportedProblem = 'PERF'`,
  );
  await pool.query(
    `INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, orderId, createdBy, createdAt)
     SELECT op.partId, 'OUT', -1, 1, 'Uso', op.orderId, ?, DATE_SUB(NOW(), INTERVAL (op.orderId % 365) DAY) FROM order_parts op
       JOIN service_orders o ON o.id = op.orderId WHERE o.reportedProblem = 'PERF'`,
    [admin.id],
  );
}, 180000);
afterAll(cerrarConexiones);

test.each(REPORTES)('el_reporte_%s_con_un_ano_de_datos_responde_en_menos_de_3_segundos', async (nombre) => {
  const url = `/api/reports/${nombre}?from=${fechaDia(-365)}&to=${fechaDia(0)}`;
  const h = { Authorization: `Bearer ${admin.token}` };
  await request(app).get(url).set(h); // calentamiento
  const inicio = process.hrtime.bigint();
  const r = await request(app).get(url).set(h);
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  // Con REPORTAR_TIEMPOS=1 imprime el tiempo medido, para registrarlo como evidencia de SC-003.
  if (process.env.REPORTAR_TIEMPOS) console.log(`SC-003 ${nombre}: ${ms.toFixed(1)} ms`);
  expect(r.status).toBe(200);
  expect(ms).toBeLessThan(3000);
}, 60000);

test('los_totales_del_ano_coinciden_con_los_datos_insertados', async () => {
  const h = { Authorization: `Bearer ${admin.token}` };
  const rango = `from=${fechaDia(-365)}&to=${fechaDia(0)}`;
  expect((await request(app).get(`/api/reports/income?${rango}`).set(h)).body.data.total).toBe('900000.00');
  expect((await request(app).get(`/api/reports/productivity?${rango}`).set(h)).body.data).toMatchObject({ totalOrders: 3000, totalLabor: '600000.00' });
});
