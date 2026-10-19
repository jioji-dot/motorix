// Acceso a datos de clientes con consultas parametrizadas.
import { pool } from '../config/db.js';
import { escaparLike } from '../validators/commonValidator.js';

const COLUMNAS = 'id, name, phone, email, active, createdAt, updatedAt';

export function toClient(fila) {
  return fila && { ...fila, active: Boolean(fila.active) };
}

export async function list({ search, active, page, pageSize }) {
  const condiciones = [];
  const parametros = [];

  if (search) {
    const patron = `%${escaparLike(search)}%`;
    const digitos = search.replace(/\D/g, '');
    condiciones.push(
      digitos ? '(name LIKE ? OR email LIKE ? OR phone LIKE ?)' : '(name LIKE ? OR email LIKE ?)',
    );
    parametros.push(patron, patron);
    if (digitos) parametros.push(`%${digitos}%`);
  }
  if (active !== undefined) {
    condiciones.push('active = ?');
    parametros.push(active ? 1 : 0);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM clients ${donde}`, parametros);
  const [filas] = await pool.query(
    `SELECT ${COLUMNAS} FROM clients ${donde} ORDER BY name ASC, id ASC LIMIT ? OFFSET ?`,
    [...parametros, pageSize, (page - 1) * pageSize],
  );
  return { items: filas.map(toClient), total };
}

export async function findById(id) {
  const [filas] = await pool.execute(`SELECT ${COLUMNAS} FROM clients WHERE id = ?`, [id]);
  return toClient(filas[0] ?? null);
}

export async function findByPhone(phone, excluirId = null) {
  const [filas] = await pool.execute(
    'SELECT id, name, phone FROM clients WHERE phone = ? AND (? IS NULL OR id <> ?) ORDER BY id LIMIT 5',
    [phone, excluirId, excluirId],
  );
  return filas;
}

export async function findVehiclesByClientId(clientId) {
  const [filas] = await pool.execute(
    `SELECT id, brand, model, year, licensePlate, vin, currentMileage
       FROM vehicles WHERE clientId = ? ORDER BY id`,
    [clientId],
  );
  return filas;
}

export async function create({ name, phone, email = null }) {
  const [resultado] = await pool.execute('INSERT INTO clients (name, phone, email) VALUES (?, ?, ?)', [
    name,
    phone,
    email ?? null,
  ]);
  return findById(resultado.insertId);
}

const CAMPOS_EDITABLES = ['name', 'phone', 'email', 'active'];

export async function update(id, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(campo === 'active' ? (datos.active ? 1 : 0) : datos[campo]);
    }
  }
  if (asignaciones.length > 0) {
    await pool.execute(`UPDATE clients SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
  return findById(id);
}
