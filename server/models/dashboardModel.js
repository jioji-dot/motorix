// Consultas agregadas del panel de control. No guardan nada: todo se calcula al consultarlo.
// Las fechas llegan como parámetros en hora local del taller ('YYYY-MM-DD').
import { pool } from '../config/db.js';

export async function ordersByStatus() {
  const [filas] = await pool.query('SELECT status, COUNT(*) AS total FROM service_orders GROUP BY status');
  return Object.fromEntries(filas.map((f) => [f.status, Number(f.total)]));
}

// Órdenes Terminadas o Entregadas con saldo por cobrar (total menos pagos Pagados).
export async function ordersWithBalance() {
  const [[fila]] = await pool.query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(t.balance), 0) AS amount
       FROM (
         SELECT o.total - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.orderId = o.id AND p.status = 'PAGADO'), 0) AS balance
           FROM service_orders o
          WHERE o.status IN ('TERMINADO', 'ENTREGADO') AND o.total > 0
       ) t
      WHERE t.balance > 0`,
  );
  return { count: Number(fila.count), amount: String(fila.amount) };
}

// Citas pendientes o confirmadas: las de hoy, las de los próximos días y las más próximas con su detalle.
export async function appointments({ today, tomorrow, limit }) {
  const base = `FROM appointments a JOIN clients c ON c.id = a.clientId JOIN vehicles v ON v.id = a.vehicleId
                 WHERE a.status IN ('PENDIENTE', 'CONFIRMADA')`;
  const [[hoy]] = await pool.query(`SELECT COUNT(*) AS total ${base} AND a.scheduledAt >= ? AND a.scheduledAt < ?`, [
    `${today} 00:00:00`,
    `${tomorrow} 00:00:00`,
  ]);
  const [[proximas]] = await pool.query(`SELECT COUNT(*) AS total ${base} AND a.scheduledAt >= ? AND a.scheduledAt < ?`, [
    `${tomorrow} 00:00:00`,
    `${limit} 00:00:00`,
  ]);
  const [siguientes] = await pool.query(
    `SELECT a.id, a.scheduledAt, a.status, a.reason, c.name AS clientName, v.licensePlate
       ${base} AND a.scheduledAt >= ? AND a.scheduledAt < ?
      ORDER BY a.scheduledAt ASC, a.id ASC LIMIT 5`,
    [`${today} 00:00:00`, `${limit} 00:00:00`],
  );
  return { today: Number(hoy.total), upcoming: Number(proximas.total), next: siguientes };
}

// Pagos Pagados cobrados entre dos fechas (inicio inclusivo, fin exclusivo).
export async function collected({ from, to }) {
  const [[fila]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE status = 'PAGADO' AND paidAt >= ? AND paidAt < ?",
    [`${from} 00:00:00`, `${to} 00:00:00`],
  );
  return String(fila.amount);
}
