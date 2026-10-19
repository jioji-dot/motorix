// Acceso a datos de usuarios con consultas parametrizadas.
import { pool } from '../config/db.js';

const COLUMNAS_PUBLICAS = 'id, username, name, email, role, active, createdAt, updatedAt';

export async function findById(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS_PUBLICAS}, failedAttempts, lockedUntil FROM users WHERE id = ?`,
    [id],
  );
  return filas[0] ?? null;
}
