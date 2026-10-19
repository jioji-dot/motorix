// Acceso a datos de órdenes de servicio con consultas parametrizadas.
// Las funciones de escritura reciben la conexión de la transacción en curso.
import { pool } from '../config/db.js';
import { escaparLike } from '../validators/commonValidator.js';

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

// Forma del listado: sin diagnóstico, líneas ni historial.
const CAMPOS_RESUMEN = [
  'id', 'folio', 'status', 'appointmentId', 'clientId', 'vehicleId', 'mechanicId', 'entryMileage',
  'reportedProblem', 'total', 'createdAt', 'updatedAt', 'client', 'vehicle', 'mechanic',
];

function toOrderSummary(fila) {
  const orden = toOrder(fila);
  return Object.fromEntries(CAMPOS_RESUMEN.map((campo) => [campo, orden[campo]]));
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

export async function list({ status, mechanicId, from, to, search, page, pageSize }) {
  const condiciones = [];
  const parametros = [];

  if (status) {
    condiciones.push('o.status = ?');
    parametros.push(status);
  }
  if (mechanicId !== undefined) {
    condiciones.push('o.mechanicId = ?');
    parametros.push(mechanicId);
  }
  if (from) {
    condiciones.push('o.createdAt >= ?');
    parametros.push(`${from} 00:00:00`);
  }
  if (to) {
    condiciones.push('o.createdAt < DATE_ADD(?, INTERVAL 1 DAY)');
    parametros.push(`${to} 00:00:00`);
  }
  if (search) {
    const patron = `%${escaparLike(search)}%`;
    condiciones.push('(o.folio LIKE ? OR c.name LIKE ? OR v.licensePlate LIKE ?)');
    parametros.push(patron, patron, patron);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM service_orders o
       JOIN clients c ON c.id = o.clientId JOIN vehicles v ON v.id = o.vehicleId ${donde}`,
    parametros,
  );
  const [filas] = await pool.query(`${SELECT_ORDEN} ${donde} ORDER BY o.createdAt DESC, o.id DESC LIMIT ? OFFSET ?`, [
    ...parametros,
    pageSize,
    (page - 1) * pageSize,
  ]);
  return { items: filas.map(toOrderSummary), total };
}

// Bloquea la orden durante la transacción para que ediciones y cambios de estado no se pisen.
export async function lockOrder(conexion, id) {
  const [filas] = await conexion.execute(
    'SELECT id, status, mechanicId FROM service_orders WHERE id = ? FOR UPDATE',
    [id],
  );
  return filas[0] ?? null;
}

const CAMPOS_EDITABLES = ['diagnosis', 'notes', 'recommendations', 'reportedProblem', 'mechanicId'];

export async function updateFields(conexion, id, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(datos[campo]);
    }
  }
  if (asignaciones.length > 0) {
    await conexion.execute(`UPDATE service_orders SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
}

// Total = servicios + mano de obra, recalculado dentro de la misma transacción de cada cambio de línea.
export async function recalculateTotal(conexion, orderId) {
  await conexion.execute(
    `UPDATE service_orders
        SET total = (SELECT COALESCE(SUM(amount), 0) FROM order_services WHERE orderId = ?)
                  + (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE orderId = ?)
      WHERE id = ?`,
    [orderId, orderId, orderId],
  );
}

export async function addService(conexion, orderId, { description, amount }) {
  const [resultado] = await conexion.execute(
    'INSERT INTO order_services (orderId, description, amount) VALUES (?, ?, ?)',
    [orderId, description, amount],
  );
  return resultado.insertId;
}

// Las operaciones de edición y baja devuelven las filas afectadas (0 si la línea no pertenece a la orden).
export async function updateService(conexion, orderId, lineId, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of ['description', 'amount']) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(datos[campo]);
    }
  }
  const [resultado] = await conexion.execute(
    `UPDATE order_services SET ${asignaciones.join(', ')} WHERE id = ? AND orderId = ?`,
    [...parametros, lineId, orderId],
  );
  return resultado.affectedRows;
}

export async function removeService(conexion, orderId, lineId) {
  const [resultado] = await conexion.execute('DELETE FROM order_services WHERE id = ? AND orderId = ?', [lineId, orderId]);
  return resultado.affectedRows;
}

export async function addLabor(conexion, orderId, { description, hours, hourlyRate }) {
  const [resultado] = await conexion.execute(
    'INSERT INTO order_labor (orderId, description, hours, hourlyRate) VALUES (?, ?, ?, ?)',
    [orderId, description, hours, hourlyRate],
  );
  return resultado.insertId;
}

export async function updateLabor(conexion, orderId, lineId, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of ['description', 'hours', 'hourlyRate']) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(datos[campo]);
    }
  }
  const [resultado] = await conexion.execute(
    `UPDATE order_labor SET ${asignaciones.join(', ')} WHERE id = ? AND orderId = ?`,
    [...parametros, lineId, orderId],
  );
  return resultado.affectedRows;
}

export async function removeLabor(conexion, orderId, lineId) {
  const [resultado] = await conexion.execute('DELETE FROM order_labor WHERE id = ? AND orderId = ?', [lineId, orderId]);
  return resultado.affectedRows;
}
