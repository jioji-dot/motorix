// Acceso a datos de `service_orders`, `order_services`, `order_labor` y `order_status_history`.
// Solo consultas SQL; las reglas de negocio viven en services/ y utils/orderStatus.js.
import { pool } from '../config/database.js';
import { escapeLike } from '../utils/normalizers.js';

const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Importes de la orden para filtrar por estado de pago (mismas reglas que utils/paymentBalance.js).
const SQL_TOTAL = `(
  (SELECT COALESCE(SUM(s.amount), 0) FROM order_services s WHERE s.order_id = o.id)
  + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id)
  + (SELECT COALESCE(SUM(pt.amount), 0) FROM order_parts pt WHERE pt.order_id = o.id)
)`;
const SQL_PAGADO = `(
  SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay WHERE pay.order_id = o.id AND pay.status = 'APROBADO'
)`;
// Solo las órdenes terminadas o entregadas se cobran; con total cero no hay cobro.
const FILTROS_DE_PAGO = {
  UNPAID: `o.status IN ('TERMINADO', 'ENTREGADO') AND ${SQL_TOTAL} > 0 AND ${SQL_PAGADO} = 0`,
  PARTIAL: `o.status IN ('TERMINADO', 'ENTREGADO') AND ${SQL_PAGADO} > 0 AND ${SQL_PAGADO} < ${SQL_TOTAL}`,
  PAID: `o.status IN ('TERMINADO', 'ENTREGADO') AND ${SQL_TOTAL} > 0 AND ${SQL_PAGADO} >= ${SQL_TOTAL}`,
  DUE: `o.status IN ('TERMINADO', 'ENTREGADO') AND ${SQL_TOTAL} > 0 AND ${SQL_PAGADO} < ${SQL_TOTAL}`
};

const ORDER_SELECT = `
  SELECT o.id, o.folio, o.appointment_id, o.client_id, o.vehicle_id, o.mechanic_id,
         o.entry_mileage, o.service_mileage, o.reported_problem, o.diagnosis, o.notes, o.recommendations,
         o.status, o.created_by, o.delivered_at, o.created_at, o.updated_at,
         c.name AS client_name, v.license_plate, v.brand, v.model, m.name AS mechanic_name,
         (SELECT COALESCE(SUM(s.amount), 0) FROM order_services s WHERE s.order_id = o.id) AS services_subtotal,
         (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = o.id) AS labor_subtotal,
         (SELECT COALESCE(SUM(pt.amount), 0) FROM order_parts pt WHERE pt.order_id = o.id) AS parts_subtotal,
         (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay WHERE pay.order_id = o.id AND pay.status = 'APROBADO') AS paid_amount,
         (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay WHERE pay.order_id = o.id AND pay.status = 'PENDIENTE') AS pending_amount,
         (SELECT t.id FROM tickets t WHERE t.order_id = o.id LIMIT 1) AS ticket_id
  FROM service_orders o
  JOIN clients c ON c.id = o.client_id
  JOIN vehicles v ON v.id = o.vehicle_id
  LEFT JOIN users m ON m.id = o.mechanic_id`;

/** Convierte una fila de MySQL al formato camelCase del contrato de la API. */
export function mapOrder(fila) {
  if (!fila) return null;
  const servicesSubtotal = redondear(fila.services_subtotal);
  const laborSubtotal = redondear(fila.labor_subtotal);
  const partsSubtotal = redondear(fila.parts_subtotal);
  return {
    id: fila.id,
    folio: fila.folio,
    appointmentId: fila.appointment_id,
    clientId: fila.client_id,
    clientName: fila.client_name,
    vehicleId: fila.vehicle_id,
    vehiclePlate: fila.license_plate,
    vehicleTitle: `${fila.brand} ${fila.model}`,
    mechanicId: fila.mechanic_id,
    mechanicName: fila.mechanic_name,
    entryMileage: fila.entry_mileage,
    serviceMileage: fila.service_mileage,
    reportedProblem: fila.reported_problem,
    diagnosis: fila.diagnosis,
    notes: fila.notes,
    recommendations: fila.recommendations,
    status: fila.status,
    createdBy: fila.created_by,
    deliveredAt: fila.delivered_at,
    servicesSubtotal,
    laborSubtotal,
    partsSubtotal,
    paidAmount: redondear(fila.paid_amount),
    pendingAmount: redondear(fila.pending_amount),
    ticketId: fila.ticket_id ?? null,
    total: redondear(servicesSubtotal + laborSubtotal + partsSubtotal),
    createdAt: fila.created_at,
    updatedAt: fila.updated_at
  };
}

export async function insertOrder(datos, db = pool) {
  const [resultado] = await db.query(
    `INSERT INTO service_orders
       (appointment_id, client_id, vehicle_id, mechanic_id, entry_mileage, reported_problem, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.appointmentId ?? null,
      datos.clientId,
      datos.vehicleId,
      datos.mechanicId ?? null,
      datos.entryMileage,
      datos.reportedProblem,
      datos.createdBy
    ]
  );
  return resultado.insertId;
}

/** Asigna el folio `OS-` + id con 6 dígitos (se hace en la misma transacción del alta). */
export async function setFolio(id, db = pool) {
  await db.query("UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE id = ?", [id]);
}

export async function insertHistory({ orderId, fromStatus, toStatus, changedBy }, db = pool) {
  await db.query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)',
    [orderId, fromStatus, toStatus, changedBy]
  );
}

export async function findOrderById(id, db = pool) {
  const [filas] = await db.query(`${ORDER_SELECT} WHERE o.id = ? LIMIT 1`, [id]);
  return mapOrder(filas[0]);
}

/**
 * Listado con filtros y paginación. Con `openFirst` las órdenes abiertas van antes que las
 * terminadas y entregadas; dentro de cada grupo, las más recientes primero.
 */
export async function listOrders(
  { status, mechanicId, clientId, search, paymentStatus, openFirst, limit, offset },
  db = pool
) {
  const condiciones = [];
  const parametros = [];

  if (status) {
    condiciones.push('o.status = ?');
    parametros.push(status);
  }
  if (mechanicId) {
    condiciones.push('o.mechanic_id = ?');
    parametros.push(mechanicId);
  }
  if (clientId) {
    condiciones.push('o.client_id = ?');
    parametros.push(clientId);
  }
  if (search) {
    const patron = `%${escapeLike(search)}%`;
    const patronPlaca = `%${escapeLike(search.replace(/[\s-]+/g, '').toUpperCase())}%`;
    condiciones.push('(o.folio LIKE ? OR c.name LIKE ? OR v.license_plate LIKE ?)');
    parametros.push(patron, patron, patronPlaca);
  }
  if (paymentStatus) condiciones.push(FILTROS_DE_PAGO[paymentStatus]);
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const orden = openFirst
    ? "ORDER BY (o.status IN ('TERMINADO', 'ENTREGADO')) ASC, o.id DESC"
    : 'ORDER BY o.id DESC';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM service_orders o
     JOIN clients c ON c.id = o.client_id
     JOIN vehicles v ON v.id = o.vehicle_id
     ${where}`,
    parametros
  );
  const [filas] = await db.query(`${ORDER_SELECT} ${where} ${orden} LIMIT ? OFFSET ?`, [
    ...parametros,
    limit,
    offset
  ]);
  return { rows: filas.map(mapOrder), total };
}

/**
 * Cambia el estado solo si la orden sigue en el estado `desde` (control de concurrencia).
 * Al entregar fija `delivered_at`.
 * @returns {Promise<boolean>} true si se aplicó el cambio
 */
export async function changeStatus(id, desde, hacia, entregar, db = pool) {
  const [resultado] = await db.query(
    `UPDATE service_orders
     SET status = ?, delivered_at = IF(?, NOW(), delivered_at)
     WHERE id = ? AND status = ?`,
    [hacia, entregar ? 1 : 0, id, desde]
  );
  return resultado.affectedRows > 0;
}

/** Actualiza solo los datos básicos recibidos (problema reportado, mecánico y kilometraje). */
export async function updateBasics(id, { reportedProblem, mechanicId, entryMileage }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (reportedProblem !== undefined) {
    columnas.push('reported_problem = ?');
    parametros.push(reportedProblem);
  }
  if (mechanicId !== undefined) {
    columnas.push('mechanic_id = ?');
    parametros.push(mechanicId);
  }
  if (entryMileage !== undefined) {
    columnas.push('entry_mileage = ?');
    parametros.push(entryMileage);
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE service_orders SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}

/** Actualiza el diagnóstico, las observaciones, las recomendaciones y/o el kilometraje de servicio recibidos. */
export async function updateWork(id, { diagnosis, notes, recommendations, serviceMileage }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (diagnosis !== undefined) {
    columnas.push('diagnosis = ?');
    parametros.push(diagnosis);
  }
  if (notes !== undefined) {
    columnas.push('notes = ?');
    parametros.push(notes);
  }
  if (recommendations !== undefined) {
    columnas.push('recommendations = ?');
    parametros.push(recommendations);
  }
  if (serviceMileage !== undefined) {
    columnas.push('service_mileage = ?');
    parametros.push(serviceMileage);
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE service_orders SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}

export async function insertService(orderId, { description, amount }, db = pool) {
  const [resultado] = await db.query(
    'INSERT INTO order_services (order_id, description, amount) VALUES (?, ?, ?)',
    [orderId, description, amount]
  );
  return resultado.insertId;
}

/** @returns {Promise<boolean>} true si el servicio existe en esa orden (aunque no cambie) */
export async function updateService(orderId, serviceId, { description, amount }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (description !== undefined) {
    columnas.push('description = ?');
    parametros.push(description);
  }
  if (amount !== undefined) {
    columnas.push('amount = ?');
    parametros.push(amount);
  }
  const [existe] = await db.query('SELECT id FROM order_services WHERE id = ? AND order_id = ?', [
    serviceId,
    orderId
  ]);
  if (existe.length === 0) return false;
  if (columnas.length > 0) {
    await db.query(`UPDATE order_services SET ${columnas.join(', ')} WHERE id = ? AND order_id = ?`, [
      ...parametros,
      serviceId,
      orderId
    ]);
  }
  return true;
}

export async function deleteService(orderId, serviceId, db = pool) {
  const [resultado] = await db.query('DELETE FROM order_services WHERE id = ? AND order_id = ?', [
    serviceId,
    orderId
  ]);
  return resultado.affectedRows > 0;
}

export async function insertLabor(orderId, { description, hours, hourlyRate }, db = pool) {
  const [resultado] = await db.query(
    'INSERT INTO order_labor (order_id, description, hours, hourly_rate) VALUES (?, ?, ?, ?)',
    [orderId, description, hours, hourlyRate]
  );
  return resultado.insertId;
}

/** @returns {Promise<boolean>} true si la línea existe en esa orden (aunque no cambie) */
export async function updateLabor(orderId, laborId, { description, hours, hourlyRate }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (description !== undefined) {
    columnas.push('description = ?');
    parametros.push(description);
  }
  if (hours !== undefined) {
    columnas.push('hours = ?');
    parametros.push(hours);
  }
  if (hourlyRate !== undefined) {
    columnas.push('hourly_rate = ?');
    parametros.push(hourlyRate);
  }
  const [existe] = await db.query('SELECT id FROM order_labor WHERE id = ? AND order_id = ?', [
    laborId,
    orderId
  ]);
  if (existe.length === 0) return false;
  if (columnas.length > 0) {
    await db.query(`UPDATE order_labor SET ${columnas.join(', ')} WHERE id = ? AND order_id = ?`, [
      ...parametros,
      laborId,
      orderId
    ]);
  }
  return true;
}

export async function deleteLabor(orderId, laborId, db = pool) {
  const [resultado] = await db.query('DELETE FROM order_labor WHERE id = ? AND order_id = ?', [
    laborId,
    orderId
  ]);
  return resultado.affectedRows > 0;
}

export async function getServices(orderId, db = pool) {
  const [filas] = await db.query(
    'SELECT id, description, amount FROM order_services WHERE order_id = ? ORDER BY id',
    [orderId]
  );
  return filas.map((f) => ({ id: f.id, description: f.description, amount: Number(f.amount) }));
}

export async function getLabor(orderId, db = pool) {
  const [filas] = await db.query(
    'SELECT id, description, hours, hourly_rate, amount FROM order_labor WHERE order_id = ? ORDER BY id',
    [orderId]
  );
  return filas.map((f) => ({
    id: f.id,
    description: f.description,
    hours: Number(f.hours),
    hourlyRate: Number(f.hourly_rate),
    amount: Number(f.amount)
  }));
}

export async function getHistory(orderId, db = pool) {
  const [filas] = await db.query(
    `SELECT h.from_status, h.to_status, h.created_at, u.id AS user_id, u.name AS user_name
     FROM order_status_history h JOIN users u ON u.id = h.changed_by
     WHERE h.order_id = ? ORDER BY h.id`,
    [orderId]
  );
  return filas.map((f) => ({
    fromStatus: f.from_status,
    toStatus: f.to_status,
    changedBy: { id: f.user_id, name: f.user_name },
    createdAt: f.created_at
  }));
}

/** Bloquea la fila de la orden hasta el fin de la transacción y devuelve su estado actual. */
export async function lockOrder(id, db) {
  const [filas] = await db.query('SELECT id, status FROM service_orders WHERE id = ? FOR UPDATE', [id]);
  return filas[0] ? { id: filas[0].id, status: filas[0].status } : null;
}

const mapOrderPart = (f) => ({
  id: f.id,
  partId: f.part_id,
  code: f.code,
  name: f.name,
  quantity: f.quantity,
  unitPrice: Number(f.unit_price),
  amount: Number(f.amount)
});

const ORDER_PART_SELECT = `
  SELECT op.id, op.part_id, p.code, p.name, op.quantity, op.unit_price, op.amount
  FROM order_parts op JOIN parts p ON p.id = op.part_id`;

export async function getParts(orderId, db = pool) {
  const [filas] = await db.query(`${ORDER_PART_SELECT} WHERE op.order_id = ? ORDER BY op.id`, [orderId]);
  return filas.map(mapOrderPart);
}

/** Línea de la orden por su identificador, bloqueada para la transacción en curso. */
export async function findOrderPartForUpdate(orderId, orderPartId, db) {
  const [filas] = await db.query(
    `${ORDER_PART_SELECT} WHERE op.order_id = ? AND op.id = ? FOR UPDATE`,
    [orderId, orderPartId]
  );
  return filas[0] ? mapOrderPart(filas[0]) : null;
}

/** Línea de la orden para una refacción, bloqueada para la transacción en curso. */
export async function findOrderPartByPartForUpdate(orderId, partId, db) {
  const [filas] = await db.query(
    `${ORDER_PART_SELECT} WHERE op.order_id = ? AND op.part_id = ? FOR UPDATE`,
    [orderId, partId]
  );
  return filas[0] ? mapOrderPart(filas[0]) : null;
}

export async function insertOrderPart({ orderId, partId, quantity, unitPrice }, db = pool) {
  const [resultado] = await db.query(
    'INSERT INTO order_parts (order_id, part_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
    [orderId, partId, quantity, unitPrice]
  );
  return resultado.insertId;
}

export async function setOrderPartQuantity(orderPartId, quantity, db = pool) {
  await db.query('UPDATE order_parts SET quantity = ? WHERE id = ?', [quantity, orderPartId]);
}

export async function deleteOrderPart(orderPartId, db = pool) {
  await db.query('DELETE FROM order_parts WHERE id = ?', [orderPartId]);
}
