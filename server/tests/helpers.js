// Ayudantes para las pruebas de integración y de contrato.
// Siempre trabajan contra la base de pruebas (el nombre debe terminar en "_test").
import bcrypt from 'bcryptjs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { recalculateTotal } from '../models/orderModel.js';

export const CONTRASENA_PRUEBA = 'Prueba2026!';

function asegurarBaseDePruebas() {
  if (!env.db.database.endsWith('_test')) {
    throw new Error(`Se negó a operar sobre "${env.db.database}": solo se permiten bases "_test".`);
  }
}

// Vacía las tablas de los sprints (en orden seguro respecto a las llaves foráneas).
export async function limpiarBase() {
  asegurarBaseDePruebas();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of [
    'audit_log',
    'terms_acceptances',
    'terms_versions',
    'settings',
    'client_notices',
    'notification_reads',
    'tickets',
    'payments',
    'maintenance',
    'inventory_movements',
    'order_parts',
    'parts',
    'order_status_history',
    'order_labor',
    'order_services',
    'service_types',
    'service_orders',
    'appointments',
    'vehicles',
    'clients',
    'users',
  ]) {
    await pool.query(`TRUNCATE TABLE ${tabla}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

export function emitirToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.secret, { expiresIn: '1h' });
}

async function insertarUsuario({ username, name, email, role }) {
  const hash = await bcrypt.hash(CONTRASENA_PRUEBA, 4);
  const [resultado] = await pool.execute(
    'INSERT INTO users (username, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, hash, role],
  );
  return { id: resultado.insertId, username, name, email, role, token: emitirToken(resultado.insertId) };
}

// Crea los tres usuarios de prueba (uno por rol) y devuelve sus datos con un token válido.
export async function crearUsuariosDePrueba() {
  asegurarBaseDePruebas();
  const definicion = [
    ['admin', 'Administrador de prueba', 'admin@motorix.test', 'ADMIN'],
    ['recepcion', 'Recepción de prueba', 'recepcion@motorix.test', 'RECEPTIONIST'],
    ['mecanico', 'Mecánico de prueba', 'mecanico@motorix.test', 'MECHANIC'],
  ];
  const usuarios = {};
  for (const [username, name, email, role] of definicion) {
    usuarios[role] = await insertarUsuario({ username, name, email, role });
  }
  return usuarios;
}

// Segundo mecánico, para probar que cada mecánico ve solo sus órdenes.
export async function crearSegundoMecanico() {
  asegurarBaseDePruebas();
  return insertarUsuario({
    username: 'mecanico.dos',
    name: 'Segundo Mecánico de prueba',
    email: 'mecanico.dos@motorix.test',
    role: 'MECHANIC',
  });
}

let contadorFixtures = 0;

// Crea un cliente activo con un vehículo directamente en la base.
export async function crearClienteConVehiculo({ km = 40000, nombre } = {}) {
  asegurarBaseDePruebas();
  contadorFixtures += 1;
  const n = String(contadorFixtures).padStart(4, '0');
  const [cliente] = await pool.execute('INSERT INTO clients (name, phone, email) VALUES (?, ?, NULL)', [
    nombre ?? `Cliente de prueba ${n}`,
    `55${n}${n}`.slice(0, 10),
  ]);
  const [vehiculo] = await pool.execute(
    `INSERT INTO vehicles (clientId, brand, model, year, licensePlate, currentMileage)
     VALUES (?, 'Nissan', 'Versa', 2020, ?, ?)`,
    [cliente.insertId, `TST-${n}`, km],
  );
  return { clientId: cliente.insertId, vehicleId: vehiculo.insertId, licensePlate: `TST-${n}` };
}

// Texto 'YYYY-MM-DDTHH:mm' en hora local, a `dias` días desde hoy.
export function fechaLocal(dias = 1, hora = '10:00') {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const dos = (valor) => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${hora}`;
}

// Inserta una cita directamente en la base.
export async function crearCita({ clientId, vehicleId, createdBy, status = 'PENDIENTE', dias = 1, hora = '10:00', reason = 'Revisión general' }) {
  asegurarBaseDePruebas();
  const [resultado] = await pool.execute(
    'INSERT INTO appointments (clientId, vehicleId, scheduledAt, reason, status, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
    [clientId, vehicleId, fechaLocal(dias, hora).replace('T', ' ') + ':00', reason, status, createdBy],
  );
  return resultado.insertId;
}

// Inserta una orden con su folio y su primer registro de historial directamente en la base.
export async function crearOrden({
  clientId,
  vehicleId,
  mechanicId,
  createdBy,
  status = 'RECIBIDO',
  appointmentId = null,
  entryMileage = 40000,
  reportedProblem = 'Ruido en el motor',
  diagnosis = null,
}) {
  asegurarBaseDePruebas();
  const [resultado] = await pool.execute(
    `INSERT INTO service_orders
       (appointmentId, clientId, vehicleId, mechanicId, entryMileage, reportedProblem, diagnosis, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [appointmentId, clientId, vehicleId, mechanicId, entryMileage, reportedProblem, diagnosis, status, createdBy],
  );
  const id = resultado.insertId;
  await pool.execute('UPDATE service_orders SET folio = ? WHERE id = ?', [`OS-${String(id).padStart(6, '0')}`, id]);
  await pool.execute('INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy) VALUES (?, NULL, ?, ?)', [
    id,
    status,
    createdBy,
  ]);
  return id;
}

let contadorRefacciones = 0;

// Inserta una refacción; si trae existencia inicial, registra su movimiento para mantener la invariante del stock.
export async function crearRefaccion({
  stock = 10,
  minimumStock = 2,
  purchasePrice = 80,
  salePrice = 120,
  active = 1,
  name,
  category = 'Aceites y filtros',
  createdBy,
} = {}) {
  asegurarBaseDePruebas();
  contadorRefacciones += 1;
  const n = String(contadorRefacciones).padStart(4, '0');
  const [resultado] = await pool.execute(
    `INSERT INTO parts (code, name, category, brand, stock, minimumStock, purchasePrice, salePrice, active)
     VALUES (?, ?, ?, 'Marca de prueba', ?, ?, ?, ?, ?)`,
    [`REF-${n}`, name ?? `Refacción de prueba ${n}`, category, stock, minimumStock, purchasePrice, salePrice, active],
  );
  if (stock > 0) {
    const [[usuario]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
    await pool.execute(
      `INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, createdBy)
       VALUES (?, 'IN', ?, ?, 'Existencia inicial', ?)`,
      [resultado.insertId, stock, stock, createdBy ?? usuario.id],
    );
  }
  return { id: resultado.insertId, code: `REF-${n}` };
}

// stock guardado y suma de sus movimientos (deben coincidir siempre).
export async function sumaDeMovimientos(partId) {
  const [[fila]] = await pool.execute(
    `SELECT p.stock AS stock, COALESCE(SUM(m.quantity), 0) AS suma
       FROM parts p LEFT JOIN inventory_movements m ON m.partId = p.id WHERE p.id = ? GROUP BY p.id`,
    [partId],
  );
  return { stock: Number(fila.stock), suma: Number(fila.suma) };
}

// Fecha 'YYYY-MM-DD' en hora local a `dias` días desde hoy.
export function fechaDia(dias = 0) {
  return fechaLocal(dias).slice(0, 10);
}

// Inserta un mantenimiento directamente en la base.
export async function crearMantenimiento({
  vehicleId,
  createdBy,
  serviceType = 'Cambio de aceite',
  lastServiceDate = fechaDia(-60),
  lastMileage = 30000,
  nextDate = null,
  nextMileage = null,
  status = 'PENDIENTE',
}) {
  asegurarBaseDePruebas();
  const [resultado] = await pool.execute(
    `INSERT INTO maintenance (vehicleId, serviceType, lastServiceDate, lastMileage, nextDate, nextMileage, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [vehicleId, serviceType, lastServiceDate, lastMileage, nextDate, nextMileage, status, createdBy],
  );
  return resultado.insertId;
}

// Inserta un pago directamente en la base (por defecto, efectivo ya pagado).
export async function crearPago({ orderId, createdBy, amount = 100, method = 'EFECTIVO', status = 'PAGADO', reference = null, externalReference = null, externalId = null }) {
  asegurarBaseDePruebas();
  const [resultado] = await pool.execute(
    `INSERT INTO payments (orderId, amount, method, status, reference, externalReference, externalId, paidAt, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${status === 'PAGADO' ? 'NOW()' : 'NULL'}, ?)`,
    [orderId, amount, method, status, reference, externalReference, externalId, createdBy],
  );
  return resultado.insertId;
}

// Crea una orden Terminada con un servicio que fija su total (por defecto 1000.00) lista para cobrarse.
export async function crearOrdenCobrable({ clientId, vehicleId, mechanicId, createdBy, total = 1000, status = 'TERMINADO' }) {
  const id = await crearOrden({ clientId, vehicleId, mechanicId, createdBy, status, diagnosis: 'Diagnóstico de prueba' });
  await pool.execute('INSERT INTO order_services (orderId, description, amount) VALUES (?, ?, ?)', [id, 'Servicio de prueba', total]);
  await pool.execute('UPDATE service_orders SET total = ? WHERE id = ?', [total, id]);
  return id;
}

// Inserta directamente una línea de refacción con su precio (por defecto, el de venta de la refacción) y recalcula
// el total de la orden con la fórmula del sistema (no una copia). No toca el stock ni los movimientos.
export async function crearLineaDeRefaccion({ orderId, partId, quantity = 1, unitPrice }) {
  asegurarBaseDePruebas();
  const [[parte]] = await pool.execute('SELECT code, name, salePrice FROM parts WHERE id = ?', [partId]);
  const [resultado] = await pool.execute(
    'INSERT INTO order_parts (orderId, partId, partCode, partName, quantity, unitPrice) VALUES (?, ?, ?, ?, ?, ?)',
    [orderId, partId, parte.code, parte.name, quantity, unitPrice ?? parte.salePrice],
  );
  await recalculateTotal(pool, orderId);
  return resultado.insertId;
}

// Hace que cada usuario indicado haya aceptado la versión vigente de los términos (si hay una publicada).
// Los seeds publican la versión 1: las pruebas que cargan seeds y llaman a la API lo usan para no recibir TERMS_NOT_ACCEPTED.
export async function aceptarTerminos(...usuarios) {
  asegurarBaseDePruebas();
  const [[vigente]] = await pool.query('SELECT MAX(version) AS version FROM terms_versions');
  if (!vigente.version) return;
  const ids = usuarios.flat().map((u) => (typeof u === 'object' ? u.id : u));
  for (const id of ids) {
    await pool.execute('INSERT IGNORE INTO terms_acceptances (userId, version) VALUES (?, ?)', [id, vigente.version]);
  }
}

// Marca como vigente la actividad de un usuario hace `minutos` minutos (para probar el cierre por inactividad).
export async function fijarActividad(userId, minutos) {
  asegurarBaseDePruebas();
  await pool.execute('UPDATE users SET lastActivityAt = DATE_SUB(NOW(), INTERVAL ? MINUTE) WHERE id = ?', [minutos, userId]);
}

// Retrasa `dias` días el último cambio de estado de una orden (para probar las órdenes detenidas).
export async function envejecerOrden(orderId, dias) {
  asegurarBaseDePruebas();
  await pool.execute('UPDATE order_status_history SET changedAt = DATE_SUB(NOW(), INTERVAL ? DAY) WHERE orderId = ?', [dias, orderId]);
}

// Crea una orden abierta con su cliente, su vehículo y una antigüedad de `dias` días sin cambio de estado.
export async function crearOrdenDetenida({ mechanicId, createdBy, dias = 5, status = 'EN_REPARACION' }) {
  const cliente = await crearClienteConVehiculo();
  const id = await crearOrden({ ...cliente, mechanicId, createdBy, status });
  await envejecerOrden(id, dias);
  return { id, ...cliente };
}

// Deja la orden con su único registro de término en la fecha indicada ('YYYY-MM-DD') y con el estado final dado.
export async function terminarEn(orderId, fecha, status = 'TERMINADO') {
  asegurarBaseDePruebas();
  await pool.execute('DELETE FROM order_status_history WHERE orderId = ?', [orderId]);
  const [[orden]] = await pool.query('SELECT createdBy FROM service_orders WHERE id = ?', [orderId]);
  await pool.execute(
    "INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy, changedAt) VALUES (?, 'EN_REPARACION', 'TERMINADO', ?, ?)",
    [orderId, orden.createdBy, `${fecha} 12:00:00`],
  );
  await pool.execute('UPDATE service_orders SET status = ? WHERE id = ?', [status, orderId]);
}

// Inserta un pago con la fecha de cobro indicada ('YYYY-MM-DD', a las 12:00).
export async function pagarEn({ orderId, createdBy, fecha, amount = 100, method = 'EFECTIVO', status = 'PAGADO' }) {
  asegurarBaseDePruebas();
  const [r] = await pool.execute(
    'INSERT INTO payments (orderId, amount, method, status, paidAt, createdBy) VALUES (?, ?, ?, ?, ?, ?)',
    [orderId, amount, method, status, status === 'PAGADO' ? `${fecha} 12:00:00` : null, createdBy],
  );
  return r.insertId;
}

// Carga los datos de ejemplo (usuarios y scripts SQL de database/seeds/) con el mismo script que `npm run seed`.
// Siempre sobre la base de pruebas: el proceso hijo hereda DB_NAME, que tests/env.js fija en una base "_test".
export function aplicarSeeds() {
  asegurarBaseDePruebas();
  const servidor = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  return execFileSync(process.execPath, ['scripts/seed.js'], { cwd: servidor, env: process.env, encoding: 'utf8' });
}

export async function cerrarConexiones() {
  await pool.end();
}
