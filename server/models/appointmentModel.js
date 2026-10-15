// Acceso a datos de la tabla `appointments`. Solo consultas SQL; las reglas viven en services/.
// `scheduled_at` es hora local de pared: se devuelve como `YYYY-MM-DDTHH:mm` sin conversiones de zona.
import { pool } from '../config/database.js';
import { dayRange } from '../utils/localDateTime.js';
import { escapeLike } from '../utils/normalizers.js';

const SELECT = `
  SELECT a.id, a.client_id, a.vehicle_id,
         DATE_FORMAT(a.scheduled_at, '%Y-%m-%dT%H:%i') AS scheduled_at,
         a.reason, a.notes, a.status, a.created_at, a.updated_at,
         c.name AS client_name, v.license_plate, v.brand, v.model,
         o.id AS order_id
  FROM appointments a
  JOIN clients c ON c.id = a.client_id
  JOIN vehicles v ON v.id = a.vehicle_id
  LEFT JOIN service_orders o ON o.appointment_id = a.id`;

/** Convierte una fila de MySQL al formato camelCase del contrato de la API. */
export function mapAppointment(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    clientId: fila.client_id,
    vehicleId: fila.vehicle_id,
    scheduledAt: fila.scheduled_at,
    reason: fila.reason,
    notes: fila.notes,
    status: fila.status,
    orderId: fila.order_id ?? null,
    clientName: fila.client_name,
    vehiclePlate: fila.license_plate,
    vehicleTitle: `${fila.brand} ${fila.model}`,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at
  };
}

export async function insert({ clientId, vehicleId, scheduledAtSql, reason, notes, createdBy }, db = pool) {
  const [resultado] = await db.query(
    `INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [clientId, vehicleId, scheduledAtSql, reason, notes, createdBy]
  );
  return resultado.insertId;
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`${SELECT} WHERE a.id = ? LIMIT 1`, [id]);
  return mapAppointment(filas[0]);
}

/** Lee la cita bloqueándola hasta terminar la transacción (evita dos órdenes de la misma cita). */
export async function findByIdForUpdate(id, db) {
  const [filas] = await db.query(`${SELECT} WHERE a.id = ? LIMIT 1 FOR UPDATE OF a`, [id]);
  return mapAppointment(filas[0]);
}

/**
 * Listado ordenado por fecha y hora.
 * Filtros: `date`, `from`/`to` (fechas `YYYY-MM-DD`), `status`, `clientId`, `vehicleId`, `search`.
 */
export async function list(
  { date, from, to, status, clientId, vehicleId, search, limit, offset },
  db = pool
) {
  const condiciones = [];
  const parametros = [];

  if (date) {
    const rango = dayRange(date);
    condiciones.push('a.scheduled_at BETWEEN ? AND ?');
    parametros.push(rango.start, rango.end);
  }
  if (from) {
    condiciones.push('a.scheduled_at >= ?');
    parametros.push(dayRange(from).start);
  }
  if (to) {
    condiciones.push('a.scheduled_at <= ?');
    parametros.push(dayRange(to).end);
  }
  if (status) {
    condiciones.push('a.status = ?');
    parametros.push(status);
  }
  if (clientId) {
    condiciones.push('a.client_id = ?');
    parametros.push(clientId);
  }
  if (vehicleId) {
    condiciones.push('a.vehicle_id = ?');
    parametros.push(vehicleId);
  }
  if (search) {
    // La placa se guarda sin espacios ni guiones: se busca también con ese formato.
    const patron = `%${escapeLike(search)}%`;
    const patronPlaca = `%${escapeLike(search.replace(/[\s-]+/g, '').toUpperCase())}%`;
    condiciones.push('(c.name LIKE ? OR v.license_plate LIKE ?)');
    parametros.push(patron, patronPlaca);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN vehicles v ON v.id = a.vehicle_id
     ${where}`,
    parametros
  );
  const [filas] = await db.query(
    `${SELECT} ${where} ORDER BY a.scheduled_at ASC, a.id ASC LIMIT ? OFFSET ?`,
    [...parametros, limit, offset]
  );
  return { rows: filas.map(mapAppointment), total };
}

/** Actualiza fecha, motivo y/o observaciones (nunca el cliente ni el vehículo). */
export async function update(id, { scheduledAtSql, reason, notes }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (scheduledAtSql !== undefined) {
    columnas.push('scheduled_at = ?');
    parametros.push(scheduledAtSql);
  }
  if (reason !== undefined) {
    columnas.push('reason = ?');
    parametros.push(reason);
  }
  if (notes !== undefined) {
    columnas.push('notes = ?');
    parametros.push(notes);
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE appointments SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}

/**
 * Cambia el estado de la cita solo si sigue en alguno de los estados esperados.
 * @returns {Promise<boolean>} true si se aplicó el cambio
 */
export async function setStatus(id, desde, hacia, db = pool) {
  const [resultado] = await db.query(
    `UPDATE appointments SET status = ? WHERE id = ? AND status IN (${desde.map(() => '?').join(', ')})`,
    [hacia, id, ...desde]
  );
  return resultado.affectedRows > 0;
}

/** Citas no canceladas del mismo vehículo en un día (para el aviso de coincidencias). */
export async function findSameDayByVehicle(vehicleId, dia, excludeId = null, db = pool) {
  const rango = dayRange(dia);
  const [filas] = await db.query(
    `SELECT id, DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i') AS scheduled_at
     FROM appointments
     WHERE vehicle_id = ? AND scheduled_at BETWEEN ? AND ? AND status <> 'CANCELADA'
       AND (? IS NULL OR id <> ?)
     ORDER BY scheduled_at, id`,
    [vehicleId, rango.start, rango.end, excludeId, excludeId]
  );
  return filas.map((f) => ({ id: f.id, scheduledAt: f.scheduled_at }));
}
