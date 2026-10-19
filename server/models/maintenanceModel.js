// Acceso a datos de mantenimientos programados con consultas parametrizadas.
import { pool } from '../config/db.js';
import { escaparLike } from '../validators/commonValidator.js';

const SELECT_MANTENIMIENTO = `
  SELECT m.id, m.vehicleId, m.serviceType,
         DATE_FORMAT(m.lastServiceDate, '%Y-%m-%d') AS lastServiceDate, m.lastMileage,
         DATE_FORMAT(m.nextDate, '%Y-%m-%d') AS nextDate, m.nextMileage,
         m.notes, m.status, m.completedAt, m.sourceOrderId, m.createdAt, m.updatedAt,
         v.brand, v.model, v.year, v.licensePlate, v.currentMileage,
         c.id AS clientId, c.name AS clientName, c.phone AS clientPhone
    FROM maintenance m
    JOIN vehicles v ON v.id = m.vehicleId
    JOIN clients  c ON c.id = v.clientId`;

function toMaintenance(fila) {
  return {
    id: fila.id,
    vehicleId: fila.vehicleId,
    serviceType: fila.serviceType,
    lastServiceDate: fila.lastServiceDate,
    lastMileage: fila.lastMileage,
    nextDate: fila.nextDate,
    nextMileage: fila.nextMileage,
    notes: fila.notes,
    status: fila.status,
    completedAt: fila.completedAt,
    sourceOrderId: fila.sourceOrderId,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
    vehicle: {
      id: fila.vehicleId,
      brand: fila.brand,
      model: fila.model,
      year: fila.year,
      licensePlate: fila.licensePlate,
      currentMileage: fila.currentMileage,
    },
    client: { id: fila.clientId, name: fila.clientName, phone: fila.clientPhone },
  };
}

export async function findById(id, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_MANTENIMIENTO} WHERE m.id = ?`, [id]);
  return filas[0] ? toMaintenance(filas[0]) : null;
}

export async function orderExists(id) {
  const [filas] = await pool.execute('SELECT id FROM service_orders WHERE id = ?', [id]);
  return filas.length > 0;
}

// Todos los mantenimientos que cumplen los filtros; la clasificación y la paginación se calculan en el servicio.
export async function listAll({ status, vehicleId, clientId, search }) {
  const condiciones = [];
  const parametros = [];
  if (status && status !== 'all') {
    condiciones.push('m.status = ?');
    parametros.push(status);
  }
  if (vehicleId !== undefined) {
    condiciones.push('m.vehicleId = ?');
    parametros.push(vehicleId);
  }
  if (clientId !== undefined) {
    condiciones.push('v.clientId = ?');
    parametros.push(clientId);
  }
  if (search) {
    const patron = `%${escaparLike(search)}%`;
    condiciones.push('(c.name LIKE ? OR v.licensePlate LIKE ? OR m.serviceType LIKE ?)');
    parametros.push(patron, patron, patron);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [filas] = await pool.query(`${SELECT_MANTENIMIENTO} ${donde} ORDER BY m.id`, parametros);
  return filas.map(toMaintenance);
}

// Registra el mantenimiento y marca como atendidos los pendientes del mismo vehículo y tipo de servicio.
export async function createReplacing(conexion, datos) {
  await conexion.execute(
    `UPDATE maintenance SET status = 'ATENDIDO', completedAt = NOW()
      WHERE vehicleId = ? AND status = 'PENDIENTE' AND LOWER(TRIM(serviceType)) = LOWER(TRIM(?))`,
    [datos.vehicleId, datos.serviceType],
  );
  const [resultado] = await conexion.execute(
    `INSERT INTO maintenance
       (vehicleId, serviceType, lastServiceDate, lastMileage, nextDate, nextMileage, notes, sourceOrderId, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.vehicleId,
      datos.serviceType,
      datos.lastServiceDate,
      datos.lastMileage,
      datos.nextDate ?? null,
      datos.nextMileage ?? null,
      datos.notes ?? null,
      datos.sourceOrderId ?? null,
      datos.createdBy,
    ],
  );
  return resultado.insertId;
}

// Bloquea el registro durante la transacción de edición.
export async function lock(conexion, id) {
  const [filas] = await conexion.execute(
    `SELECT id, vehicleId, serviceType, DATE_FORMAT(lastServiceDate, '%Y-%m-%d') AS lastServiceDate, lastMileage,
            DATE_FORMAT(nextDate, '%Y-%m-%d') AS nextDate, nextMileage, status
       FROM maintenance WHERE id = ? FOR UPDATE`,
    [id],
  );
  return filas[0] ?? null;
}

const CAMPOS_EDITABLES = ['serviceType', 'lastServiceDate', 'lastMileage', 'nextDate', 'nextMileage', 'notes'];

export async function update(conexion, id, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(datos[campo]);
    }
  }
  if (asignaciones.length > 0) {
    await conexion.execute(`UPDATE maintenance SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
}
