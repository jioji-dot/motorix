// Pool de conexiones a MySQL (solo el backend accede a la base de datos).
import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  // Las columnas DATETIME se manejan como cadenas UTC para evitar desfases de zona horaria.
  timezone: 'Z',
  dateStrings: false
});

/**
 * Ejecuta una función dentro de una transacción.
 * Si la función lanza un error, se revierte; de lo contrario se confirma.
 */
export async function withTransaction(fn) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await fn(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
