// Acceso a datos de usuarios con consultas parametrizadas.
import { pool } from '../config/db.js';
import { escaparLike } from '../validators/commonValidator.js';

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

export async function resetAttempts(id, conexion = pool) {
  await conexion.execute('UPDATE users SET failedAttempts = 0, lockedUntil = NULL WHERE id = ?', [id]);
}

export async function updatePasswordHash(id, passwordHash, conexion = pool) {
  await conexion.execute('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, id]);
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

// ---------------------------------------------------------------------------
// Gestión de usuarios (solo ADMIN). Las funciones aceptan una conexión opcional
// para ejecutarse dentro de una transacción.
// ---------------------------------------------------------------------------

export function toPublicUser(fila) {
  return (
    fila && {
      id: fila.id,
      username: fila.username,
      name: fila.name,
      email: fila.email,
      role: fila.role,
      active: Boolean(fila.active),
      createdAt: fila.createdAt,
      updatedAt: fila.updatedAt,
    }
  );
}

export async function list({ search, role, active, page, pageSize }) {
  const condiciones = [];
  const parametros = [];

  if (search) {
    const patron = `%${escaparLike(search)}%`;
    condiciones.push('(name LIKE ? OR username LIKE ? OR email LIKE ?)');
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
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${donde}`, parametros);
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS_PUBLICAS} FROM users ${donde} ORDER BY name ASC, id ASC LIMIT ? OFFSET ?`,
    [...parametros, pageSize, (page - 1) * pageSize],
  );
  return { items: filas.map(toPublicUser), total };
}

export async function findPublicById(id, conexion = pool) {
  const [filas] = await conexion.execute(`SELECT ${COLUMNAS_PUBLICAS} FROM users WHERE id = ?`, [id]);
  return toPublicUser(filas[0] ?? null);
}

// Cuenta los administradores activos bloqueando esas filas hasta terminar la transacción.
export async function countActiveAdmins(conexion = pool) {
  const [filas] = await conexion.query("SELECT id FROM users WHERE role = 'ADMIN' AND active = 1 FOR UPDATE");
  return filas.length;
}

export async function create({ username, name, email, role, passwordHash }) {
  const [resultado] = await pool.execute(
    'INSERT INTO users (username, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, passwordHash, role],
  );
  return findPublicById(resultado.insertId);
}

const CAMPOS_EDITABLES = ['name', 'email', 'role', 'active'];

export async function update(id, datos, conexion = pool) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(campo === 'active' ? (datos.active ? 1 : 0) : datos[campo]);
    }
  }
  if (asignaciones.length > 0) {
    await conexion.execute(`UPDATE users SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
  return findPublicById(id, conexion);
}
