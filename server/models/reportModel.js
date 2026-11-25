// Consultas agregadas de los reportes (Sprint 7, FR-009 a FR-013). Todo se calcula de los datos existentes (RN-10).
// Las órdenes cuentan por la fecha en que quedaron Terminadas (último registro `TERMINADO` del historial de estados).
import { pool } from '../config/db.js';

const FIN = 'DATE_ADD(?, INTERVAL 1 DAY)';
const ORDENES_TERMINADAS = `
  WITH ordenes AS (
    SELECT o.id, o.mechanicId,
           (SELECT MAX(h.changedAt) FROM order_status_history h WHERE h.orderId = o.id AND h.toStatus = 'TERMINADO') AS finishedAt
      FROM service_orders o
     WHERE o.status IN ('TERMINADO', 'ENTREGADO')
  )`;
const EN_RANGO = `o.finishedAt >= ? AND o.finishedAt < ${FIN}`;
const limites = (from, to) => [`${from} 00:00:00`, `${to} 00:00:00`];

export async function income({ from, to, groupBy }) {
  const formato = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const [filas] = await pool.query(
    `SELECT DATE_FORMAT(paidAt, '${formato}') AS period, method, SUM(amount) AS total
       FROM payments
      WHERE status = 'PAGADO' AND paidAt >= ? AND paidAt < ${FIN}
      GROUP BY period, method ORDER BY period, method`,
    limites(from, to),
  );
  return filas.map((f) => ({ period: f.period, method: f.method, total: String(f.total) }));
}

export async function services({ from, to }) {
  const [filas] = await pool.query(
    `${ORDENES_TERMINADAS}
     SELECT MIN(COALESCE(t.name, TRIM(s.description))) AS name, MAX(t.id IS NOT NULL) AS typed, COUNT(*) AS count, SUM(s.amount) AS amount
       FROM ordenes o
       JOIN order_services s ON s.orderId = o.id
       LEFT JOIN service_types t ON t.id = s.serviceTypeId
      WHERE ${EN_RANGO}
      GROUP BY COALESCE(CONCAT('t', t.id), CONCAT('d', LOWER(TRIM(s.description))))
      ORDER BY count DESC, name ASC`,
    limites(from, to),
  );
  return filas.map((f) => ({ name: f.name, typed: Boolean(f.typed), count: Number(f.count), amount: String(f.amount) }));
}

export async function productivity({ from, to }) {
  const [filas] = await pool.query(
    `${ORDENES_TERMINADAS}
     SELECT u.id, u.name, COUNT(DISTINCT o.id) AS orders,
            COALESCE((SELECT SUM(l.amount) FROM order_labor l JOIN ordenes o2 ON o2.id = l.orderId
                       WHERE o2.mechanicId = u.id AND o2.finishedAt >= ? AND o2.finishedAt < ${FIN}), 0) AS labor
       FROM ordenes o JOIN users u ON u.id = o.mechanicId
      WHERE ${EN_RANGO}
      GROUP BY u.id, u.name ORDER BY orders DESC, u.name ASC`,
    [...limites(from, to), ...limites(from, to)],
  );
  return filas.map((f) => ({ id: f.id, name: f.name, orders: Number(f.orders), labor: String(f.labor) }));
}

export async function parts({ from, to }) {
  const [filas] = await pool.query(
    `${ORDENES_TERMINADAS}
     SELECT p.id, p.code, p.name, p.purchasePrice, SUM(op.quantity) AS units, SUM(op.amount) AS sale
       FROM ordenes o
       JOIN order_parts op ON op.orderId = o.id
       JOIN parts p ON p.id = op.partId
      WHERE ${EN_RANGO}
      GROUP BY p.id, p.code, p.name, p.purchasePrice ORDER BY sale DESC, p.name ASC`,
    limites(from, to),
  );
  return filas.map((f) => ({
    id: f.id, code: f.code, name: f.name, purchasePrice: String(f.purchasePrice), units: Number(f.units), sale: String(f.sale),
  }));
}

export async function rotation({ from, to }) {
  const [filas] = await pool.query(
    `SELECT p.id, p.code, p.name, p.stock, -SUM(m.quantity) AS unitsOut
       FROM inventory_movements m JOIN parts p ON p.id = m.partId
      WHERE m.orderId IS NOT NULL AND m.createdAt >= ? AND m.createdAt < ${FIN}
      GROUP BY p.id, p.code, p.name, p.stock HAVING unitsOut > 0
      ORDER BY unitsOut DESC, p.name ASC`,
    limites(from, to),
  );
  return filas.map((f) => ({ id: f.id, code: f.code, name: f.name, stock: Number(f.stock), unitsOut: Number(f.unitsOut) }));
}
