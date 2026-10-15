// Acceso a datos de la tabla `vehicles`. Solo consultas SQL; las reglas viven en services/.
import { pool } from '../config/database.js';
import { escapeLike } from '../utils/normalizers.js';

export const VEHICLE_COLUMNS = `v.id, v.client_id, v.brand, v.model, v.year, v.license_plate,
  v.vin, v.color, v.current_mileage, v.created_at, v.updated_at`;

// Columnas editables: nombre en la API → columna en la base.
const COLUMNAS_EDITABLES = {
  brand: 'brand',
  model: 'model',
  year: 'year',
  licensePlate: 'license_plate',
  vin: 'vin',
  color: 'color',
  currentMileage: 'current_mileage'
};

/** Convierte una fila de MySQL al formato camelCase del contrato de la API. */
export function mapVehicle(fila) {
  if (!fila) return null;
  const vehiculo = {
    id: fila.id,
    clientId: fila.client_id,
    brand: fila.brand,
    model: fila.model,
    year: fila.year,
    licensePlate: fila.license_plate,
    vin: fila.vin,
    color: fila.color,
    currentMileage: fila.current_mileage,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at
  };
  if (fila.owner_name !== undefined) vehiculo.ownerName = fila.owner_name;
  return vehiculo;
}

export async function insert(datos, db = pool) {
  const [resultado] = await db.query(
    `INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, color, current_mileage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.clientId,
      datos.brand,
      datos.model,
      datos.year,
      datos.licensePlate,
      datos.vin,
      datos.color,
      datos.currentMileage
    ]
  );
  return resultado.insertId;
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`SELECT ${VEHICLE_COLUMNS} FROM vehicles v WHERE v.id = ? LIMIT 1`, [
    id
  ]);
  return mapVehicle(filas[0]);
}

/** Lee el vehículo bloqueando su fila hasta terminar la transacción (serializa las altas de órdenes). */
export async function findByIdForUpdate(id, db) {
  const [filas] = await db.query(
    `SELECT ${VEHICLE_COLUMNS} FROM vehicles v WHERE v.id = ? LIMIT 1 FOR UPDATE`,
    [id]
  );
  return mapVehicle(filas[0]);
}

/** Vehículo con los datos de su propietario. */
export async function findByIdWithOwner(id, db = pool) {
  const [filas] = await db.query(
    `SELECT ${VEHICLE_COLUMNS}, c.name AS owner_name, c.phone AS owner_phone
     FROM vehicles v JOIN clients c ON c.id = v.client_id
     WHERE v.id = ? LIMIT 1`,
    [id]
  );
  const fila = filas[0];
  if (!fila) return null;
  const { ownerName, ...vehiculo } = mapVehicle(fila);
  return { ...vehiculo, owner: { id: fila.client_id, name: ownerName, phone: fila.owner_phone } };
}

export async function listByClientId(clientId, db = pool) {
  const [filas] = await db.query(
    `SELECT ${VEHICLE_COLUMNS} FROM vehicles v WHERE v.client_id = ? ORDER BY v.brand, v.model, v.id`,
    [clientId]
  );
  return filas.map(mapVehicle);
}

/** Listado con búsqueda por placa, marca, modelo o propietario, filtro por propietario y paginación. */
export async function list({ search, clientId, limit, offset }, db = pool) {
  const condiciones = [];
  const parametros = [];

  if (search) {
    const patron = `%${escapeLike(search)}%`;
    // La placa se guarda sin espacios ni guiones; se busca también con ese formato.
    const patronPlaca = `%${escapeLike(search.replace(/[\s-]+/g, '').toUpperCase())}%`;
    condiciones.push(
      '(v.license_plate LIKE ? OR v.license_plate LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR c.name LIKE ?)'
    );
    parametros.push(patron, patronPlaca, patron, patron, patron);
  }
  if (clientId) {
    condiciones.push('v.client_id = ?');
    parametros.push(clientId);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM vehicles v JOIN clients c ON c.id = v.client_id ${where}`,
    parametros
  );
  const [filas] = await db.query(
    `SELECT ${VEHICLE_COLUMNS}, c.name AS owner_name
     FROM vehicles v JOIN clients c ON c.id = v.client_id
     ${where}
     ORDER BY v.license_plate ASC, v.id ASC
     LIMIT ? OFFSET ?`,
    [...parametros, limit, offset]
  );
  return { rows: filas.map(mapVehicle), total };
}

/** Actualiza solo los campos recibidos (nunca `client_id`). */
export async function update(id, campos, db = pool) {
  const columnas = [];
  const parametros = [];
  for (const [clave, columna] of Object.entries(COLUMNAS_EDITABLES)) {
    if (campos[clave] !== undefined) {
      columnas.push(`${columna} = ?`);
      parametros.push(campos[clave]);
    }
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE vehicles SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}
