// Acceso a datos de las refacciones usadas en una orden (con instantánea de precio, código y nombre).
// Las funciones de escritura reciben la conexión de la transacción en curso.

export async function findByOrderAndPart(conexion, orderId, partId) {
  const [filas] = await conexion.execute('SELECT id FROM order_parts WHERE orderId = ? AND partId = ?', [orderId, partId]);
  return filas[0] ?? null;
}

// La línea se bloquea para que dos cambios de cantidad simultáneos no se pisen.
export async function lockLine(conexion, orderId, lineId) {
  const [filas] = await conexion.execute(
    'SELECT id, orderId, partId, partCode, partName, quantity, unitPrice FROM order_parts WHERE id = ? AND orderId = ? FOR UPDATE',
    [lineId, orderId],
  );
  return filas[0] ?? null;
}

export async function add(conexion, { orderId, partId, partCode, partName, quantity, unitPrice }) {
  const [resultado] = await conexion.execute(
    'INSERT INTO order_parts (orderId, partId, partCode, partName, quantity, unitPrice) VALUES (?, ?, ?, ?, ?, ?)',
    [orderId, partId, partCode, partName, quantity, unitPrice],
  );
  return resultado.insertId;
}

export async function setQuantity(conexion, lineId, quantity) {
  await conexion.execute('UPDATE order_parts SET quantity = ? WHERE id = ?', [quantity, lineId]);
}

export async function remove(conexion, lineId) {
  await conexion.execute('DELETE FROM order_parts WHERE id = ?', [lineId]);
}

// Líneas de la orden por refacción ascendente: el orden fijo evita bloqueos cruzados al cancelar.
export async function listByOrder(conexion, orderId) {
  const [filas] = await conexion.execute(
    'SELECT id, partId, quantity FROM order_parts WHERE orderId = ? ORDER BY partId ASC',
    [orderId],
  );
  return filas;
}
