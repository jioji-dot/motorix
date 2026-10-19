// Acceso a datos de usuarios con consultas parametrizadas.
import { pool } from '../config/db.js';

const COLUMNAS_PUBLICAS = 'id, username, name, email, role, active, createdAt, updatedAt';
const COLUMNAS_AUTENTICACION = `${COLUMNAS_PUBLICAS}, passwordHash, failedAttempts, lockedUntil`;

export async function findById(id) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS_PUBLICAS}, failedAttempts, lockedUntil FROM users WHERE id = ?`,
    [id],
  );
  return filas[0] ?? null;
}

export async function findAuthById(id) {
  const [filas] = await pool.execute(`SELECT ${COLUMNAS_AUTENTICACION} FROM users WHERE id = ?`, [id]);
  return filas[0] ?? null;
}

export async function findAuthByUsername(username) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS_AUTENTICACION} FROM users WHERE LOWER(username) = LOWER(?)`,
    [username],
  );
  return filas[0] ?? null;
}

export async function findAuthByEmail(email) {
  const [filas] = await pool.execute(
    `SELECT ${COLUMNAS_AUTENTICACION} FROM users WHERE LOWER(email) = LOWER(?)`,
    [email],
  );
  return filas[0] ?? null;
}

export async function registerFailedAttempt(id) {
  await pool.execute('UPDATE users SET failedAttempts = failedAttempts + 1 WHERE id = ?', [id]);
}

// Bloquea la cuenta hasta la fecha indicada y reinicia el contador.
export async function lockAccount(id, hasta) {
  await pool.execute('UPDATE users SET failedAttempts = 0, lockedUntil = ? WHERE id = ?', [hasta, id]);
}

export async function resetAttempts(id) {
  await pool.execute('UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE id = ?', [id]);
}

export async function updatePasswordHash(id, passwordHash) {
  await pool.execute('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, id]);
}

// Crea el usuario solo si no existe (por nombre de usuario). No toca contraseñas ya cambiadas.
export async function insertIfMissing({ username, name, email, role, passwordHash }) {
  const [existentes] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
  if (existentes.length > 0) return false;
  await pool.execute(
    `INSERT INTO users (username, name, email, passwordHash, role)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [username, name, email, passwordHash, role],
  );
  return true; // se insertó uno nuevo
}

// Crea el usuario o lo actualiza (incluida la contraseña) si el nombre de usuario ya existe.
export async function upsert({ username, name, email, role, passwordHash }) {
  await pool.execute(
    `INSERT INTO users (username, name, email, passwordHash, role)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email),
       role = VALUES(role), passwordHash = VALUES(passwordHash), active = 1,
       failedAttempts = 0, lockedUntil = NULL`,
    [username, name, email, passwordHash, role],
  );
}
