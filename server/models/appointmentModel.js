// Acceso a datos de citas con consultas parametrizadas.
import { pool } from '../config/db.js';
import { aDatetimeLocal, escaparLike } from '../validators/commonValidator.js';

const SELECT_BASE = `
  SELECT a.id, a.clientId, a.vehicleId, a.scheduledAt, a.reason, a.notes, a.status, a.createdAt, a.updatedAt,
         c.name AS clientName, c.phone AS clientPhone,
         v.brand, v.model, v.year, v.licensePlate,
         (SELECT o.id FROM service_orders o
           WHERE o.appointmentId = a.id AND o.status <> 'CANCELADA'
           ORDER BY o.id DESC LIMIT 1) AS orderId
    FROM appointments a
    JOIN clients  c ON c.id = a.clientId
    JOIN vehicles v ON v.id = a.vehicleId`;

export function toAppointment(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    clientId: fila.clientId,
    vehicleId: fila.vehicleId,
    scheduledAt: fila.scheduledAt,
    reason: fila.reason,
    notes: fila.notes,
    status: fila.status,
    orderId: fila.orderId ?? null,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
    client: { id: fila.clientId, name: fila.clientName, phone: fila.clientPhone },
    vehicle: { id: fila.vehicleId, brand: fila.brand, model: fila.model, year: fila.year, licensePlate: fila.licensePlate },
  };
}

export async function list({ from, to, status, clientId, vehicleId, search, page, pageSize }) {
  const condiciones = [];
  const parametros = [];

  if (from) {
    condiciones.push('a.scheduledAt >= ?');
    parametros.push(`${from} 00:00:00`);
  }
  if (to) {
    condiciones.push('a.scheduledAt < DATE_ADD(?, INTERVAL 1 DAY)');
    parametros.push(`${to} 00:00:00`);
  }
  if (status) {
    condiciones.push('a.status = ?');
    parametros.push(status);
  }
  if (clientId !== undefined) {
    condiciones.push('a.clientId = ?');
    parametros.push(clientId);
  }
  if (vehicleId !== undefined) {
    condiciones.push('a.vehicleId = ?');
    parametros.push(vehicleId);
  }
  if (search) {
    const patron = `%${escaparLike(search)}%`;
    condiciones.push('(c.name LIKE ? OR v.licensePlate LIKE ?)');
    parametros.push(patron, patron);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM appointments a
       JOIN clients c ON c.id = a.clientId JOIN vehicles v ON v.id = a.vehicleId ${donde}`,
    parametros,
  );
  const [filas] = await pool.query(`${SELECT_BASE} ${donde} ORDER BY a.scheduledAt ASC, a.id ASC LIMIT ? OFFSET ?`, [
    ...parametros,
    pageSize,
    (page - 1) * pageSize,
  ]);
  return { items: filas.map(toAppointment), total };
}

export async function findById(id) {
  const [filas] = await pool.execute(`${SELECT_BASE} WHERE a.id = ?`, [id]);
  return toAppointment(filas[0] ?? null);
}

// Otra cita activa del mismo vehículo a la misma fecha y hora.
export async function findDuplicate(vehicleId, scheduledAt, excluirId = null) {
  const [filas] = await pool.execute(
    `SELECT id, scheduledAt, status FROM appointments
      WHERE vehicleId = ? AND scheduledAt = ? AND status IN ('PENDIENTE','CONFIRMADA','EN_PROCESO')
        AND (? IS NULL OR id <> ?)
      ORDER BY id LIMIT 1`,
    [vehicleId, aDatetimeLocal(scheduledAt), excluirId, excluirId],
  );
  return filas[0] ?? null;
}

export async function hasActiveOrder(appointmentId, conexion = pool) {
  const [[{ total }]] = await conexion.execute(
    "SELECT COUNT(*) AS total FROM service_orders WHERE appointmentId = ? AND status <> 'CANCELADA'",
    [appointmentId],
  );
  return total > 0;
}

export async function create({ clientId, vehicleId, scheduledAt, reason, notes = null, createdBy }) {
  const [resultado] = await pool.execute(
    `INSERT INTO appointments (clientId, vehicleId, scheduledAt, reason, notes, createdBy)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [clientId, vehicleId, aDatetimeLocal(scheduledAt), reason, notes ?? null, createdBy],
  );
  return findById(resultado.insertId);
}

export async function update(id, datos) {
  const asignaciones = [];
  const parametros = [];
  if (datos.scheduledAt !== undefined) {
    asignaciones.push('scheduledAt = ?');
    parametros.push(aDatetimeLocal(datos.scheduledAt));
  }
  if (datos.reason !== undefined) {
    asignaciones.push('reason = ?');
    parametros.push(datos.reason);
  }
  if (datos.notes !== undefined) {
    asignaciones.push('notes = ?');
    parametros.push(datos.notes);
  }
  if (asignaciones.length > 0) {
    await pool.execute(`UPDATE appointments SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
  return findById(id);
}

// `conexion` permite cambiar el estado dentro de la transacción de una orden.
export async function setStatus(id, status, conexion = pool) {
  await conexion.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}
