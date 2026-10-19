// Acceso a datos de vehículos con consultas parametrizadas.
import { pool } from '../config/db.js';
import { escaparLike } from '../validators/commonValidator.js';

const SELECT_BASE = `
  SELECT v.id, v.clientId, v.brand, v.model, v.year, v.licensePlate, v.vin, v.currentMileage,
         v.createdAt, v.updatedAt, c.name AS clientName, c.phone AS clientPhone
    FROM vehicles v
    JOIN clients c ON c.id = v.clientId`;

export function toVehicle({ clientName, clientPhone, ...vehiculo }) {
  return { ...vehiculo, client: { id: vehiculo.clientId, name: clientName, phone: clientPhone } };
}

export async function list({ search, clientId, page, pageSize }) {
  const condiciones = [];
  const parametros = [];

  if (search) {
    const patron = `%${escaparLike(search)}%`;
    condiciones.push('(v.licensePlate LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR c.name LIKE ?)');
    parametros.push(patron, patron, patron, patron);
  }
  if (clientId !== undefined) {
    condiciones.push('v.clientId = ?');
    parametros.push(clientId);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM vehicles v JOIN clients c ON c.id = v.clientId ${donde}`,
    parametros,
  );
  const [filas] = await pool.query(`${SELECT_BASE} ${donde} ORDER BY v.licensePlate ASC, v.id ASC LIMIT ? OFFSET ?`, [
    ...parametros,
    pageSize,
    (page - 1) * pageSize,
  ]);
  return { items: filas.map(toVehicle), total };
}

export async function findById(id) {
  const [filas] = await pool.execute(`${SELECT_BASE} WHERE v.id = ?`, [id]);
  return filas[0] ? toVehicle(filas[0]) : null;
}

export async function findByLicensePlate(licensePlate, excluirId = null) {
  const [filas] = await pool.execute(
    'SELECT id, licensePlate FROM vehicles WHERE licensePlate = ? AND (? IS NULL OR id <> ?) LIMIT 1',
    [licensePlate, excluirId, excluirId],
  );
  return filas[0] ?? null;
}

export async function findByVin(vin, excluirId = null) {
  const [filas] = await pool.execute(
    'SELECT id, vin FROM vehicles WHERE vin = ? AND (? IS NULL OR id <> ?) LIMIT 1',
    [vin, excluirId, excluirId],
  );
  return filas[0] ?? null;
}

export async function create({ clientId, brand, model, year, licensePlate, vin = null, currentMileage }) {
  const [resultado] = await pool.execute(
    `INSERT INTO vehicles (clientId, brand, model, year, licensePlate, vin, currentMileage)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, brand, model, year, licensePlate, vin ?? null, currentMileage],
  );
  return findById(resultado.insertId);
}

const CAMPOS_EDITABLES = ['brand', 'model', 'year', 'licensePlate', 'vin', 'currentMileage'];

export async function update(id, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(datos[campo]);
    }
  }
  if (asignaciones.length > 0) {
    await pool.execute(`UPDATE vehicles SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
  return findById(id);
}

// Sube el kilometraje actual sin bajarlo nunca (por ejemplo, al registrar el kilometraje de un servicio).
export async function raiseMileage(id, mileage, conexion = pool) {
  await conexion.execute('UPDATE vehicles SET currentMileage = GREATEST(currentMileage, ?) WHERE id = ?', [mileage, id]);
}

// Actualiza el kilometraje actual (por ejemplo, al crear una orden). Acepta la conexión de una transacción.
export async function updateMileage(id, currentMileage, conexion = pool) {
  await conexion.execute('UPDATE vehicles SET currentMileage = ? WHERE id = ?', [currentMileage, id]);
}
