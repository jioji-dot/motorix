// Ayudantes para las pruebas de integración y de contrato.
// Siempre trabajan contra la base de pruebas (el nombre debe terminar en "_test").
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

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
    'order_status_history',
    'order_labor',
    'order_services',
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

export async function cerrarConexiones() {
  await pool.end();
}
