// Acceso a datos de la tabla `clients`. Solo consultas SQL; las reglas viven en services/.
import { pool } from '../config/database.js';
import { escapeLike } from '../utils/normalizers.js';

const COLUMNAS = 'id, name, phone, email, address, active, created_at, updated_at';

/** Convierte una fila de MySQL al formato camelCase del contrato de la API. */
export function mapClient(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    name: fila.name,
    phone: fila.phone,
    email: fila.email,
    address: fila.address,
    active: Boolean(fila.active),
    createdAt: fila.created_at,
    updatedAt: fila.updated_at
  };
}

export async function insert({ name, phone, email, address }, db = pool) {
  const [resultado] = await db.query(
    'INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)',
    [name, phone, email, address]
  );
  return resultado.insertId;
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`SELECT ${COLUMNAS} FROM clients WHERE id = ? LIMIT 1`, [id]);
  return mapClient(filas[0]);
}

/** Listado con búsqueda por nombre, teléfono o correo y paginación. */
export async function list({ search, limit, offset }, db = pool) {
  const condiciones = [];
  const parametros = [];
  if (search) {
    const patron = `%${escapeLike(search)}%`;
    condiciones.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    parametros.push(patron, patron, patron);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM clients ${where}`, parametros);
  const [filas] = await db.query(
    `SELECT ${COLUMNAS} FROM clients ${where} ORDER BY name ASC, id ASC LIMIT ? OFFSET ?`,
    [...parametros, limit, offset]
  );
  return { rows: filas.map(mapClient), total };
}

/**
 * Clientes cuyo teléfono coincide con los dígitos indicados (ignora espacios, guiones y signos).
 * @param {string} digits teléfono reducido a dígitos
 * @param {number} [excludeId] cliente a omitir (al editar)
 */
export async function findByPhoneDigits(digits, excludeId = null, db = pool) {
  const [filas] = await db.query(
    `SELECT id, name FROM clients
     WHERE REGEXP_REPLACE(phone, '[^0-9]', '') = ? AND (? IS NULL OR id <> ?)
     ORDER BY id`,
    [digits, excludeId, excludeId]
  );
  return filas;
}

/** Actualiza solo los campos recibidos. */
export async function update(id, campos, db = pool) {
  const columnas = [];
  const parametros = [];
  for (const [clave, valor] of Object.entries(campos)) {
    columnas.push(`${clave} = ?`);
    parametros.push(valor);
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE clients SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}
