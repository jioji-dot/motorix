// Consultas de conteo y suma del panel de control. Solo SQL: no guardan nada y reutilizan las mismas
// reglas que los módulos de origen para que ningún dato difiera (FR-024).
import { pool } from '../config/database.js';
import { ORDER_STATUS } from '../config/constants.js';
import { fromCents, toCents } from '../utils/money.js';
import { toPaymentSummary } from '../utils/paymentBalance.js';

/** Órdenes por estado (todas las existentes) como `{ RECIBIDO: n, ... }`. */
export async function ordersByStatus(db = pool) {
  const [filas] = await db.query('SELECT status, COUNT(*) AS total FROM service_orders GROUP BY status');
  return Object.fromEntries(filas.map((f) => [f.status, Number(f.total)]));
}

/** Órdenes entregadas hoy (día local del servidor, igual que `delivered_at` escrito con NOW()). */
export async function deliveredToday(db = pool) {
  const [[fila]] = await db.query(
    "SELECT COUNT(*) AS total FROM service_orders WHERE status = ? AND DATE(delivered_at) = CURDATE()",
    [ORDER_STATUS.DELIVERED]
  );
  return Number(fila.total);
}

/**
 * Citas pendientes o confirmadas de hoy y de los próximos 7 días (hoy incluido hasta 7 días después).
 * `today` es el día local `YYYY-MM-DD` de las fechas de calendario.
 */
export async function appointmentCounts({ today }, db = pool) {
  const [[fila]] = await db.query(
    `SELECT
       COALESCE(SUM(DATE(scheduled_at) = ?), 0) AS today,
       COALESCE(SUM(DATE(scheduled_at) BETWEEN ? AND DATE_ADD(?, INTERVAL 7 DAY)), 0) AS next7
     FROM appointments
     WHERE status IN ('PENDIENTE', 'CONFIRMADA')`,
    [today, today, today]
  );
  return { today: Number(fila.today), next7Days: Number(fila.next7) };
}

/** Siguiente cita pendiente o confirmada a partir de `now` (hora local de pared `YYYY-MM-DD HH:mm:ss`). */
export async function nextAppointment({ now }, db = pool) {
  const [filas] = await db.query(
    `SELECT a.id, DATE_FORMAT(a.scheduled_at, '%Y-%m-%dT%H:%i') AS scheduled_at, a.reason,
            c.name AS client_name, v.license_plate
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN vehicles v ON v.id = a.vehicle_id
     WHERE a.status IN ('PENDIENTE', 'CONFIRMADA') AND a.scheduled_at >= ?
     ORDER BY a.scheduled_at ASC, a.id ASC
     LIMIT 1`,
    [now]
  );
  const f = filas[0];
  return f
    ? { id: f.id, scheduledAt: f.scheduled_at, clientName: f.client_name, vehiclePlate: f.license_plate, reason: f.reason }
    : null;
}

/** Refacciones activas en alerta más críticas: las agotadas primero y luego las de menor existencia. */
export async function criticalParts(limit, db = pool) {
  const [filas] = await db.query(
    `SELECT id, code, name, stock, minimum_stock
     FROM parts
     WHERE active = 1 AND stock <= minimum_stock
     ORDER BY (stock = 0) DESC, (stock / GREATEST(minimum_stock, 1)) ASC, name ASC, id ASC
     LIMIT ?`,
    [limit]
  );
  return filas.map((f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    stock: f.stock,
    minimumStock: f.minimum_stock,
    stockStatus: f.stock === 0 ? 'OUT' : 'LOW'
  }));
}

/** Suma de los pagos aprobados hoy (los anulados, cancelados, rechazados y pendientes no cuentan). */
export async function collectedToday(db = pool) {
  const [[fila]] = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'APROBADO' AND DATE(created_at) = CURDATE()"
  );
  return fromCents(toCents(fila.total));
}

/**
 * Saldo y número de órdenes terminadas o entregadas con saldo mayor a cero. Calcula el saldo de cada
 * orden con `paymentBalance.js` (centavos), igual que el resto del sistema. Agrega cada tabla una sola
 * vez (en lugar de subconsultas por orden) para responder rápido con miles de pagos.
 */
export async function receivableTotals(db = pool) {
  const [filas] = await db.query(
    `SELECT o.id,
            COALESCE(s.total, 0) + COALESCE(l.total, 0) + COALESCE(pt.total, 0) AS total,
            COALESCE(pay.total, 0) AS paid
     FROM service_orders o
     LEFT JOIN (SELECT order_id, SUM(amount) AS total FROM order_services GROUP BY order_id) s ON s.order_id = o.id
     LEFT JOIN (SELECT order_id, SUM(amount) AS total FROM order_labor GROUP BY order_id) l ON l.order_id = o.id
     LEFT JOIN (SELECT order_id, SUM(amount) AS total FROM order_parts GROUP BY order_id) pt ON pt.order_id = o.id
     LEFT JOIN (
       SELECT order_id, SUM(amount) AS total FROM payments WHERE status = 'APROBADO' GROUP BY order_id
     ) pay ON pay.order_id = o.id
     WHERE o.status IN ('TERMINADO', 'ENTREGADO')`
  );
  let saldoCents = 0;
  let ordenes = 0;
  for (const f of filas) {
    const { balance } = toPaymentSummary({ total: f.total, paid: f.paid, pending: 0 });
    if (balance > 0) {
      saldoCents += toCents(balance);
      ordenes += 1;
    }
  }
  return { pendingBalance: fromCents(saldoCents), ordersToCollect: ordenes };
}
