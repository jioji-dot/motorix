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

// Vacía las tablas del sprint (en orden seguro respecto a las llaves foráneas).
export async function limpiarBase() {
  asegurarBaseDePruebas();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of ['vehicles', 'clients', 'users']) {
    await pool.query(`TRUNCATE TABLE ${tabla}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

// Crea los tres usuarios de prueba (uno por rol) y devuelve sus datos con un token válido.
export async function crearUsuariosDePrueba() {
  asegurarBaseDePruebas();
  const hash = await bcrypt.hash(CONTRASENA_PRUEBA, 4);
  const definicion = [
    ['admin', 'Administrador de prueba', 'admin@motorix.test', 'ADMIN'],
    ['recepcion', 'Recepción de prueba', 'recepcion@motorix.test', 'RECEPTIONIST'],
    ['mecanico', 'Mecánico de prueba', 'mecanico@motorix.test', 'MECHANIC'],
  ];
  const usuarios = {};
  for (const [username, name, email, role] of definicion) {
    const [resultado] = await pool.execute(
      'INSERT INTO users (username, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)',
      [username, name, email, hash, role],
    );
    usuarios[role] = { id: resultado.insertId, username, name, email, role, token: emitirToken(resultado.insertId) };
  }
  return usuarios;
}

export function emitirToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.secret, { expiresIn: '1h' });
}

export async function cerrarConexiones() {
  await pool.end();
}
