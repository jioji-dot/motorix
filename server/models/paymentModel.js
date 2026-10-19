// Acceso a datos de pagos con consultas parametrizadas.
// Las funciones de escritura reciben la conexión de la transacción en curso.
import { pool } from '../config/db.js';

const SELECT_PAGO = `
  SELECT p.id, p.orderId, p.amount, p.method, p.status, p.reference, p.paymentLink, p.paidAt,
         p.externalReference, p.externalId, p.createdAt, p.updatedAt, u.id AS userId, u.name AS userName
    FROM payments p
    JOIN users u ON u.id = p.createdBy`;

// El enlace de pago solo se devuelve en los pagos de Mercado Pago; la referencia externa es interna.
export function toPayment(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.orderId,
    amount: fila.amount,
    method: fila.method,
    status: fila.status,
    reference: fila.reference ?? null,
    paymentLink: fila.paymentLink ?? null,
    paidAt: fila.paidAt ?? null,
    createdBy: { id: fila.userId, name: fila.userName },
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

// Orden con su total, sin bloquear.
export async function findOrder(orderId, conexion = pool) {
  const [filas] = await conexion.execute('SELECT id, folio, status, total FROM service_orders WHERE id = ?', [orderId]);
  return filas[0] ?? null;
}

// Bloquea la orden mientras dura la transacción: serializa los cobros de una misma orden.
export async function lockOrder(conexion, orderId) {
  const [filas] = await conexion.execute('SELECT id, folio, status, total FROM service_orders WHERE id = ? FOR UPDATE', [orderId]);
  return filas[0] ?? null;
}

// Suma de pagos Pagados y Pendientes de una orden (como texto de dos decimales).
export async function sums(orderId, conexion = pool) {
  const [[fila]] = await conexion.execute(
    `SELECT COALESCE(SUM(CASE WHEN status = 'PAGADO' THEN amount END), 0) AS paid,
            COALESCE(SUM(CASE WHEN status = 'PENDIENTE' THEN amount END), 0) AS pending
       FROM payments WHERE orderId = ?`,
    [orderId],
  );
  return { paid: String(fila.paid), pending: String(fila.pending) };
}

export async function insert(conexion, datos) {
  const [resultado] = await conexion.execute(
    `INSERT INTO payments
       (orderId, amount, method, status, reference, externalReference, paymentLink, paidAt, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${datos.status === 'PAGADO' ? 'NOW()' : 'NULL'}, ?)`,
    [
      datos.orderId,
      datos.amount,
      datos.method,
      datos.status,
      datos.reference ?? null,
      datos.externalReference ?? null,
      datos.paymentLink ?? null,
      datos.createdBy,
    ],
  );
  return resultado.insertId;
}

export async function listByOrder(orderId, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_PAGO} WHERE p.orderId = ? ORDER BY p.id DESC`, [orderId]);
  return filas.map(toPayment);
}

export async function findById(id, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_PAGO} WHERE p.id = ?`, [id]);
  return filas[0] ? { ...toPayment(filas[0]), externalReference: filas[0].externalReference, externalId: filas[0].externalId } : null;
}

export async function findByExternalReference(externalReference, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_PAGO} WHERE p.externalReference = ?`, [externalReference]);
  return filas[0] ? { ...toPayment(filas[0]), externalReference: filas[0].externalReference, externalId: filas[0].externalId } : null;
}

// Cambia el estado solo si el pago sigue Pendiente (actualización condicionada: idempotente y segura ante carreras).
// Devuelve las filas afectadas: 0 significa que otro proceso ya lo resolvió.
export async function transitionFromPending(conexion, id, { status, externalId = null }) {
  const [resultado] = await conexion.execute(
    `UPDATE payments
        SET status = ?, externalId = COALESCE(?, externalId), paidAt = ${status === 'PAGADO' ? 'NOW()' : 'NULL'}
      WHERE id = ? AND status = 'PENDIENTE'`,
    [status, externalId, id],
  );
  return resultado.affectedRows;
}
