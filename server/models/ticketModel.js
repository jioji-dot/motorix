// Acceso a datos de `tickets`. Solo consultas SQL; el contenido del comprobante se arma en
// utils/ticketBuilder.js a partir de la orden y sus pagos (no se guardan copias).
import { pool } from '../config/database.js';
import { escapeLike } from '../utils/normalizers.js';

const TICKET_SELECT = `
  SELECT t.id, t.folio, t.order_id, t.created_at, u.name AS generated_by_name
  FROM tickets t
  JOIN users u ON u.id = t.generated_by`;

const mapTicket = (fila) =>
  fila
    ? {
        id: fila.id,
        folio: fila.folio,
        orderId: fila.order_id,
        createdAt: fila.created_at,
        generatedByName: fila.generated_by_name
      }
    : null;

/** Inserta el ticket de una orden; la llave única impide un segundo ticket para la misma orden. */
export async function insert({ orderId, generatedBy }, db = pool) {
  const [resultado] = await db.query('INSERT INTO tickets (order_id, generated_by) VALUES (?, ?)', [
    orderId,
    generatedBy
  ]);
  return resultado.insertId;
}

/** Asigna el folio `TK-` + identificador con 6 dígitos (en la misma transacción del alta). */
export async function setFolio(id, db = pool) {
  await db.query("UPDATE tickets SET folio = CONCAT('TK-', LPAD(id, 6, '0')) WHERE id = ?", [id]);
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`${TICKET_SELECT} WHERE t.id = ? LIMIT 1`, [id]);
  return mapTicket(filas[0]);
}

export async function findByOrderId(orderId, db = pool) {
  const [filas] = await db.query(`${TICKET_SELECT} WHERE t.order_id = ? LIMIT 1`, [orderId]);
  return mapTicket(filas[0]);
}

/** Listado con búsqueda por folio del ticket o de la orden, cliente y placas. */
export async function list({ search, limit, offset }, db = pool) {
  const condiciones = [];
  const parametros = [];
  if (search) {
    const patron = `%${escapeLike(search)}%`;
    condiciones.push('(t.folio LIKE ? OR o.folio LIKE ? OR c.name LIKE ? OR v.license_plate LIKE ?)');
    parametros.push(patron, patron, patron, patron);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const desde = `FROM tickets t
    JOIN service_orders o ON o.id = t.order_id
    JOIN clients c ON c.id = o.client_id
    JOIN vehicles v ON v.id = o.vehicle_id`;

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${desde} ${where}`, parametros);
  // Primero se obtiene la página y solo después se calculan los importes de esas filas.
  const [filas] = await db.query(
    `SELECT x.*,
            (SELECT COALESCE(SUM(s.amount), 0) FROM order_services s WHERE s.order_id = x.order_id)
              + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.order_id = x.order_id)
              + (SELECT COALESCE(SUM(pt.amount), 0) FROM order_parts pt WHERE pt.order_id = x.order_id) AS total_amount,
            (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay WHERE pay.order_id = x.order_id AND pay.status = 'APROBADO') AS paid_amount,
            (SELECT COALESCE(SUM(pay.amount), 0) FROM payments pay WHERE pay.order_id = x.order_id AND pay.status = 'PENDIENTE') AS pending_amount
     FROM (
       SELECT t.id, t.folio, t.created_at, o.id AS order_id, o.folio AS order_folio,
              c.name AS client_name, v.license_plate
       ${desde} ${where}
       ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?
     ) x
     ORDER BY x.created_at DESC, x.id DESC`,
    [...parametros, limit, offset]
  );
  return { rows: filas, total: Number(total) };
}
