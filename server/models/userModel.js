// Acceso a datos de la tabla `users`. Solo consultas SQL; las reglas de negocio viven en services/.
import { pool } from '../config/database.js';
import { escapeLike } from '../utils/normalizers.js';

const COLUMNAS = `id, username, name, email, password_hash, role, active,
  failed_login_attempts, locked_until, created_at, updated_at`;

/** Convierte una fila de MySQL al formato camelCase usado en el backend. */
export function mapUser(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    username: fila.username,
    name: fila.name,
    email: fila.email,
    passwordHash: fila.password_hash,
    role: fila.role,
    active: Boolean(fila.active),
    failedLoginAttempts: fila.failed_login_attempts,
    lockedUntil: fila.locked_until,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at
  };
}

export async function findByUsername(username, db = pool) {
  const [filas] = await db.query(`SELECT ${COLUMNAS} FROM users WHERE username = ? LIMIT 1`, [
    username
  ]);
  return mapUser(filas[0]);
}

export async function findByEmail(email, db = pool) {
  const [filas] = await db.query(`SELECT ${COLUMNAS} FROM users WHERE email = ? LIMIT 1`, [email]);
  return mapUser(filas[0]);
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`SELECT ${COLUMNAS} FROM users WHERE id = ? LIMIT 1`, [id]);
  return mapUser(filas[0]);
}

/** Actualiza el contador de intentos fallidos y el bloqueo temporal. */
export async function updateLoginState(id, { failedLoginAttempts, lockedUntil }, db = pool) {
  await db.query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [
    failedLoginAttempts,
    lockedUntil,
    id
  ]);
}

export async function updatePasswordHash(id, passwordHash, db = pool) {
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

export async function insert({ username, name, email, passwordHash, role }, db = pool) {
  const [resultado] = await db.query(
    'INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, passwordHash, role]
  );
  return resultado.insertId;
}

/** Listado con búsqueda (usuario, nombre o correo), filtros por rol y estado, y paginación. */
export async function list({ search, role, active, limit, offset }, db = pool) {
  const condiciones = [];
  const parametros = [];
  if (search) {
    const patron = `%${escapeLike(search)}%`;
    condiciones.push('(username LIKE ? OR name LIKE ? OR email LIKE ?)');
    parametros.push(patron, patron, patron);
  }
  if (role) {
    condiciones.push('role = ?');
    parametros.push(role);
  }
  if (active !== undefined) {
    condiciones.push('active = ?');
    parametros.push(active ? 1 : 0);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users ${where}`, parametros);
  const [filas] = await db.query(
    `SELECT ${COLUMNAS} FROM users ${where} ORDER BY username ASC, id ASC LIMIT ? OFFSET ?`,
    [...parametros, limit, offset]
  );
  return { rows: filas.map(mapUser), total };
}

/** Actualiza solo los campos recibidos (nunca `username` ni la contraseña). */
export async function update(id, { name, email, role, active }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (name !== undefined) {
    columnas.push('name = ?');
    parametros.push(name);
  }
  if (email !== undefined) {
    columnas.push('email = ?');
    parametros.push(email);
  }
  if (role !== undefined) {
    columnas.push('role = ?');
    parametros.push(role);
  }
  if (active !== undefined) {
    columnas.push('active = ?');
    parametros.push(active ? 1 : 0);
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE users SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}

/** Mecánicos activos para asignar órdenes (solo id, nombre y usuario). */
export async function listActiveMechanics(db = pool) {
  const [filas] = await db.query(
    "SELECT id, name, username FROM users WHERE role = 'MECHANIC' AND active = 1 ORDER BY name ASC, id ASC"
  );
  return filas.map((f) => ({ id: f.id, name: f.name, username: f.username }));
}

export async function countActiveAdmins(db = pool) {
  const [[{ total }]] = await db.query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1"
  );
  return total;
}
