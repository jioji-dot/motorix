// Acceso a datos de `payments`. Solo consultas SQL; las reglas de negocio viven en services/ y
// utils/paymentBalance.js. Los pagos nunca se eliminan (RN-9, FR-009).
import { pool } from '../config/database.js';
import { PAYMENT_STATUS } from '../config/constants.js';
import { dayRange } from '../utils/localDateTime.js';
import { fromCents, toCents } from '../utils/money.js';
import { escapeLike } from '../utils/normalizers.js';

const PAYMENT_SELECT = `
  SELECT p.id, p.order_id, p.method, p.amount, p.status, p.reference, p.external_reference,
         p.external_id, p.payment_url, p.void_reason, p.voided_at, p.created_at,
         o.folio AS order_folio, c.name AS client_name, v.license_plate,
         cu.name AS created_by_name, vu.name AS voided_by_name
  FROM payments p
  JOIN service_orders o ON o.id = p.order_id
  JOIN clients c ON c.id = o.client_id
  JOIN vehicles v ON v.id = o.vehicle_id
  JOIN users cu ON cu.id = p.created_by
  LEFT JOIN users vu ON vu.id = p.voided_by`;

/** Convierte una fila de MySQL al formato camelCase del contrato (sin las acciones por usuario). */
export function mapPayment(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.order_id,
    orderFolio: fila.order_folio,
    clientName: fila.client_name,
    vehiclePlate: fila.license_plate,
    method: fila.method,
    amount: Number(fila.amount),
    status: fila.status,
    reference: fila.reference,
    externalReference: fila.external_reference,
    externalId: fila.external_id,
    paymentUrl: fila.payment_url,
    voidReason: fila.void_reason,
    voidedByName: fila.voided_by_name,
    voidedAt: fila.voided_at,
    createdByName: fila.created_by_name,
    createdAt: fila.created_at
  };
}

/** Inserta un pago. `amountCents` evita los errores de coma flotante. */
export async function insert(datos, db = pool) {
  const [resultado] = await db.query(
    `INSERT INTO payments
       (order_id, method, amount, status, reference, external_reference, external_id, payment_url, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.orderId,
      datos.method,
      fromCents(datos.amountCents),
      datos.status,
      datos.reference ?? null,
      datos.externalReference ?? null,
      datos.externalId ?? null,
      datos.paymentUrl ?? null,
      datos.createdBy
    ]
  );
  return resultado.insertId;
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`${PAYMENT_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
  return mapPayment(filas[0]);
}

/** Pagos de una orden, del más reciente al más antiguo (incluye cancelados, rechazados y anulados). */
export async function listByOrder(orderId, db = pool) {
  const [filas] = await db.query(`${PAYMENT_SELECT} WHERE p.order_id = ? ORDER BY p.created_at DESC, p.id DESC`, [
    orderId
  ]);
  return filas.map(mapPayment);
}

/** Cobro de Mercado Pago pendiente de la orden (a lo más uno), o null. */
export async function findPendingMercadoPago(orderId, db = pool) {
  const [filas] = await db.query(
    `${PAYMENT_SELECT} WHERE p.order_id = ? AND p.method = 'MERCADO_PAGO' AND p.status = 'PENDIENTE' LIMIT 1`,
    [orderId]
  );
  return mapPayment(filas[0]);
}

/** Pagos aprobados y pendientes de una orden, en centavos (para calcular el saldo). */
export async function sumsByOrder(orderId, db = pool) {
  const [[fila]] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'APROBADO' THEN amount END), 0) AS paid,
       COALESCE(SUM(CASE WHEN status = 'PENDIENTE' THEN amount END), 0) AS pending
     FROM payments WHERE order_id = ?`,
    [orderId]
  );
  return { paidCents: toCents(fila.paid), pendingCents: toCents(fila.pending) };
}

/** Condiciones de filtrado del listado: estado, método, rango de fechas del pago y búsqueda. */
function buildFilters({ status, method, from, to, search }) {
  const condiciones = [];
  const parametros = [];
  if (status) {
    condiciones.push('p.status = ?');
    parametros.push(status);
  }
  if (method) {
    condiciones.push('p.method = ?');
    parametros.push(method);
  }
  if (from) {
    condiciones.push('p.created_at >= ?');
    parametros.push(dayRange(from).start);
  }
  if (to) {
    condiciones.push('p.created_at <= ?');
    parametros.push(dayRange(to).end);
  }
  if (search) {
    const patron = `%${escapeLike(search)}%`;
    const patronPlaca = `%${escapeLike(search.replace(/[\s-]+/g, '').toUpperCase())}%`;
    condiciones.push('(o.folio LIKE ? OR c.name LIKE ? OR v.license_plate LIKE ?)');
    parametros.push(patron, patron, patronPlaca);
  }
  return { where: condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '', parametros };
}

const FROM_LISTADO = `
  FROM payments p
  JOIN service_orders o ON o.id = p.order_id
  JOIN clients c ON c.id = o.client_id
  JOIN vehicles v ON v.id = o.vehicle_id`;

/** Listado con filtros y paginación; `approvedTotal` suma los aprobados que cumplen el filtro. */
export async function list(filtros, { limit, offset }, db = pool) {
  const { where, parametros } = buildFilters(filtros);
  const [[{ total, aprobado }]] = await db.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN p.status = 'APROBADO' THEN p.amount END), 0) AS aprobado
     ${FROM_LISTADO} ${where}`,
    parametros
  );
  const [filas] = await db.query(
    `${PAYMENT_SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...parametros, limit, offset]
  );
  return { rows: filas.map(mapPayment), total, approvedTotal: fromCents(toCents(aprobado)) };
}

/** Bloquea la fila del pago y devuelve su estado actual (dentro de una transacción). */
export async function lockById(id, db) {
  const [filas] = await db.query(
    'SELECT id, order_id, method, status FROM payments WHERE id = ? FOR UPDATE',
    [id]
  );
  return filas[0] ?? null;
}

/**
 * Cambia el estado solo si el pago sigue en `desde` (control de concurrencia).
 * @returns {Promise<boolean>} true si se aplicó el cambio
 */
export async function updateStatus(id, desde, hacia, campos = {}, db = pool) {
  const columnas = ['status = ?'];
  const parametros = [hacia];
  if (campos.externalId !== undefined) {
    columnas.push('external_id = ?');
    parametros.push(campos.externalId);
  }
  const [resultado] = await db.query(
    `UPDATE payments SET ${columnas.join(', ')} WHERE id = ? AND status = ?`,
    [...parametros, id, desde]
  );
  return resultado.affectedRows > 0;
}

/** Anula un pago aprobado con su motivo, usuario y fecha. */
export async function markVoided(id, { reason, userId }, db = pool) {
  const [resultado] = await db.query(
    `UPDATE payments
     SET status = ?, void_reason = ?, voided_by = ?, voided_at = NOW()
     WHERE id = ? AND status = ?`,
    [PAYMENT_STATUS.VOIDED, reason, userId, id, PAYMENT_STATUS.APPROVED]
  );
  return resultado.affectedRows > 0;
}
