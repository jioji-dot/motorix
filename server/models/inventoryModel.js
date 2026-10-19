// Acceso a datos del inventario: bloqueo de la refacción, stock y movimientos (inmutables).
// Las funciones de escritura reciben la conexión de la transacción en curso.
import { pool } from '../config/db.js';

// Bloquea la refacción durante la transacción para que dos movimientos simultáneos no se pisen.
export async function lockPart(conexion, partId) {
  const [filas] = await conexion.execute(
    'SELECT id, code, name, stock, salePrice, active FROM parts WHERE id = ? FOR UPDATE',
    [partId],
  );
  return filas[0] ?? null;
}

export async function setStock(conexion, partId, stock) {
  await conexion.execute('UPDATE parts SET stock = ? WHERE id = ?', [stock, partId]);
}

export async function insertMovement(conexion, { partId, type, quantity, stockAfter, reason, orderId = null, createdBy }) {
  const [resultado] = await conexion.execute(
    `INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, orderId, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [partId, type, quantity, stockAfter, reason, orderId, createdBy],
  );
  return resultado.insertId;
}

const SELECT_MOVIMIENTO = `
  SELECT m.id, m.type, m.quantity, m.stockAfter, m.reason, m.orderId, o.folio AS orderFolio,
         m.createdAt, u.id AS userId, u.name AS userName
    FROM inventory_movements m
    JOIN users u ON u.id = m.createdBy
    LEFT JOIN service_orders o ON o.id = m.orderId`;

function toMovement(fila) {
  return {
    id: fila.id,
    type: fila.type,
    quantity: fila.quantity,
    stockAfter: fila.stockAfter,
    reason: fila.reason,
    orderId: fila.orderId ?? null,
    orderFolio: fila.orderFolio ?? null,
    createdBy: { id: fila.userId, name: fila.userName },
    createdAt: fila.createdAt,
  };
}

export async function findMovement(id, conexion = pool) {
  const [filas] = await conexion.execute(`${SELECT_MOVIMIENTO} WHERE m.id = ?`, [id]);
  return filas[0] ? toMovement(filas[0]) : null;
}

// Movimientos de una refacción, del más reciente al más antiguo.
export async function listMovements(partId, { page, pageSize }) {
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM inventory_movements WHERE partId = ?', [partId]);
  const [filas] = await pool.query(`${SELECT_MOVIMIENTO} WHERE m.partId = ? ORDER BY m.id DESC LIMIT ? OFFSET ?`, [
    partId,
    pageSize,
    (page - 1) * pageSize,
  ]);
  return { items: filas.map(toMovement), total };
}
