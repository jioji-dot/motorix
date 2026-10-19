// Acceso a datos de órdenes de servicio con consultas parametrizadas.
// Las funciones de escritura reciben la conexión de la transacción en curso.
import { pool } from '../config/db.js';

const SELECT_ORDEN = `
  SELECT o.id, o.folio, o.appointmentId, o.clientId, o.vehicleId, o.mechanicId, o.entryMileage,
         o.reportedProblem, o.diagnosis, o.notes, o.recommendations, o.status, o.cancellationReason,
         o.total, o.deliveredAt, o.createdAt, o.updatedAt,
         c.name AS clientName,
         v.brand, v.model, v.year, v.licensePlate,
         m.name AS mechanicName
    FROM service_orders o
    JOIN clients  c ON c.id = o.clientId
    JOIN vehicles v ON v.id = o.vehicleId
    JOIN users    m ON m.id = o.mechanicId`;

export function folioDe(id) {
  return `OS-${String(id).padStart(6, '0')}`;
}

function toOrder(fila) {
  return {
    id: fila.id,
    folio: fila.folio,
    status: fila.status,
    appointmentId: fila.appointmentId ?? null,
    clientId: fila.clientId,
    vehicleId: fila.vehicleId,
    mechanicId: fila.mechanicId,
    entryMileage: fila.entryMileage,
    reportedProblem: fila.reportedProblem,
    diagnosis: fila.diagnosis,
    notes: fila.notes,
    recommendations: fila.recommendations,
    cancellationReason: fila.cancellationReason,
    deliveredAt: fila.deliveredAt,
    total: fila.total,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
    client: { id: fila.clientId, name: fila.clientName },
    vehicle: { id: fila.vehicleId, brand: fila.brand, model: fila.model, year: fila.year, licensePlate: fila.licensePlate },
    mechanic: { id: fila.mechanicId, name: fila.mechanicName },
  };
}

// Bloquea la cita mientras dura la transacción para que dos altas simultáneas no creen dos órdenes activas.
export async function lockAppointment(conexion, appointmentId) {
  await conexion.execute('SELECT id FROM appointments WHERE id = ? FOR UPDATE', [appointmentId]);
}

// Inserta la orden, le asigna el folio y registra el primer estado del historial.
export async function create(conexion, datos) {
  const [resultado] = await conexion.execute(
    `INSERT INTO service_orders
       (appointmentId, clientId, vehicleId, mechanicId, entryMileage, reportedProblem, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, 'RECIBIDO', ?)`,
    [
      datos.appointmentId ?? null,
      datos.clientId,
      datos.vehicleId,
      datos.mechanicId,
      datos.entryMileage,
      datos.reportedProblem,
      datos.createdBy,
    ],
  );
  const id = resultado.insertId;
  await conexion.execute('UPDATE service_orders SET folio = ? WHERE id = ?', [folioDe(id), id]);
  await conexion.execute(
    'INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy) VALUES (?, NULL, ?, ?)',
    [id, 'RECIBIDO', datos.createdBy],
  );
  return id;
}

// Orden completa con cliente, vehículo, mecánico, líneas e historial.
export async function findDetail(id, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_ORDEN} WHERE o.id = ?`, [id]);
  if (!filas[0]) return null;

  const [services] = await conexion.execute(
    'SELECT id, description, amount FROM order_services WHERE orderId = ? ORDER BY id',
    [id],
  );
  const [labor] = await conexion.execute(
    'SELECT id, description, hours, hourlyRate, amount FROM order_labor WHERE orderId = ? ORDER BY id',
    [id],
  );
  const [historial] = await conexion.execute(
    `SELECT h.fromStatus, h.toStatus, h.reason, h.changedAt, u.id AS userId, u.name AS userName
       FROM order_status_history h
       JOIN users u ON u.id = h.changedBy
      WHERE h.orderId = ? ORDER BY h.id`,
    [id],
  );

  return {
    ...toOrder(filas[0]),
    services,
    labor,
    history: historial.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedBy: { id: h.userId, name: h.userName },
      reason: h.reason,
      changedAt: h.changedAt,
    })),
  };
}
