// Acceso a datos de `parts` e `inventory_movements`.
// Solo consultas SQL; las reglas de negocio viven en services/ y utils/stockStatus.js.
//
// Invariante: parts.stock = SUM(inventory_movements.quantity). Todo cambio de existencia pasa por
// `applyMovement`, que actualiza ambas tablas dentro de la transacción del llamador (D5, D7).
import { pool } from '../config/database.js';
import { errors } from '../utils/AppError.js';
import { escapeLike } from '../utils/normalizers.js';
import { getStockStatus } from '../utils/stockStatus.js';

const PART_COLUMNS = `p.id, p.code, p.name, p.description, p.price, p.stock, p.minimum_stock,
  p.active, p.created_at, p.updated_at`;

/** Convierte una fila de MySQL al formato camelCase del contrato de la API. */
export function mapPart(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    code: fila.code,
    name: fila.name,
    description: fila.description,
    price: Number(fila.price),
    stock: fila.stock,
    minimumStock: fila.minimum_stock,
    active: Boolean(fila.active),
    stockStatus: getStockStatus({ stock: fila.stock, minimumStock: fila.minimum_stock }),
    createdAt: fila.created_at,
    updatedAt: fila.updated_at
  };
}

export function mapMovement(fila) {
  return {
    id: Number(fila.id),
    partId: fila.part_id,
    type: fila.type,
    quantity: fila.quantity,
    reason: fila.reason,
    orderId: fila.order_id,
    orderFolio: fila.order_folio ?? null,
    createdBy: fila.created_by,
    createdByName: fila.created_by_name ?? null,
    createdAt: fila.created_at
  };
}

export async function insert(datos, db = pool) {
  const [resultado] = await db.query(
    'INSERT INTO parts (code, name, description, price, minimum_stock) VALUES (?, ?, ?, ?, ?)',
    [datos.code, datos.name, datos.description ?? null, datos.price, datos.minimumStock ?? 0]
  );
  return resultado.insertId;
}

export async function findById(id, db = pool) {
  const [filas] = await db.query(`SELECT ${PART_COLUMNS} FROM parts p WHERE p.id = ? LIMIT 1`, [id]);
  return mapPart(filas[0]);
}

/** Bloquea la fila de la refacción hasta el fin de la transacción. */
export async function findByIdForUpdate(id, db) {
  const [filas] = await db.query(`SELECT ${PART_COLUMNS} FROM parts p WHERE p.id = ? LIMIT 1 FOR UPDATE`, [id]);
  return mapPart(filas[0]);
}

export async function findByCode(code, db = pool) {
  const [filas] = await db.query(`SELECT ${PART_COLUMNS} FROM parts p WHERE p.code = ? LIMIT 1`, [code]);
  return mapPart(filas[0]);
}

// Filtros de alerta de existencia (solo refacciones activas); deben coincidir con utils/stockStatus.js.
const FILTROS_DE_ALERTA = {
  LOW: 'p.active = 1 AND p.stock > 0 AND p.stock <= p.minimum_stock',
  OUT: 'p.active = 1 AND p.stock = 0',
  ANY: 'p.active = 1 AND p.stock <= p.minimum_stock'
};

/**
 * Listado con búsqueda por código o nombre, filtro de activas, filtro de alerta (`LOW`, `OUT` o
 * `ANY`, que solo considera refacciones activas) y paginación.
 */
export async function list({ search, active, alert, limit, offset }, db = pool) {
  const condiciones = [];
  const parametros = [];

  if (search) {
    const patron = `%${escapeLike(search)}%`;
    condiciones.push('(p.code LIKE ? OR p.name LIKE ?)');
    parametros.push(patron, patron);
  }
  if (active !== undefined) {
    condiciones.push('p.active = ?');
    parametros.push(active ? 1 : 0);
  }
  if (alert) condiciones.push(FILTROS_DE_ALERTA[alert]);
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM parts p ${where}`, parametros);
  const [filas] = await db.query(
    `SELECT ${PART_COLUMNS} FROM parts p ${where} ORDER BY p.name ASC, p.id ASC LIMIT ? OFFSET ?`,
    [...parametros, limit, offset]
  );
  return { rows: filas.map(mapPart), total };
}

const COLUMNAS_EDITABLES = {
  code: 'code',
  name: 'name',
  description: 'description',
  price: 'price',
  minimumStock: 'minimum_stock'
};

/** Actualiza solo los campos recibidos (nunca `stock`). */
export async function update(id, campos, db = pool) {
  const columnas = [];
  const parametros = [];
  for (const [clave, columna] of Object.entries(COLUMNAS_EDITABLES)) {
    if (campos[clave] !== undefined) {
      columnas.push(`${columna} = ?`);
      parametros.push(campos[clave]);
    }
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE parts SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}

export async function setActive(id, active, db = pool) {
  await db.query('UPDATE parts SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
}

/**
 * Cambia la existencia y registra el movimiento en la misma transacción (D5, D7).
 * `quantity` lleva signo: IN > 0, OUT < 0 (exige `orderId`), ADJUSTMENT distinto de 0.
 * La actualización está condicionada a que la existencia no quede negativa; si no se cumple,
 * lanza `INSUFFICIENT_STOCK` sin registrar nada. `conn` debe ser una conexión transaccional.
 */
export async function applyMovement(
  { partId, type, quantity, reason, orderId = null, createdBy },
  conn
) {
  const [resultado] = await conn.query(
    `UPDATE parts SET stock = CAST(stock AS SIGNED) + ?
     WHERE id = ? AND CAST(stock AS SIGNED) + ? >= 0`,
    [quantity, partId, quantity]
  );
  if (resultado.affectedRows === 0) {
    const [[pieza]] = await conn.query('SELECT stock FROM parts WHERE id = ?', [partId]);
    if (!pieza) throw errors.notFound('La refacción no existe.');
    throw errors.insufficientStock({ partId, available: pieza.stock, requested: Math.abs(quantity) });
  }
  const [insertado] = await conn.query(
    `INSERT INTO inventory_movements (part_id, type, quantity, reason, order_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [partId, type, quantity, reason, orderId, createdBy]
  );
  return Number(insertado.insertId);
}

const MOVEMENT_SELECT = `
  SELECT m.id, m.part_id, m.type, m.quantity, m.reason, m.order_id, m.created_by, m.created_at,
         o.folio AS order_folio, u.name AS created_by_name
  FROM inventory_movements m
  LEFT JOIN service_orders o ON o.id = m.order_id
  LEFT JOIN users u ON u.id = m.created_by`;

export async function findMovementById(id, db = pool) {
  const [filas] = await db.query(`${MOVEMENT_SELECT} WHERE m.id = ? LIMIT 1`, [id]);
  return filas[0] ? mapMovement(filas[0]) : null;
}

/** Movimientos de una refacción, del más reciente al más antiguo, con paginación. */
export async function listMovements(partId, { limit, offset }, db = pool) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM inventory_movements WHERE part_id = ?',
    [partId]
  );
  const [filas] = await db.query(
    `${MOVEMENT_SELECT} WHERE m.part_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
    [partId, limit, offset]
  );
  return { rows: filas.map(mapMovement), total };
}

/** Refacciones activas con existencia que coinciden con el texto (código o nombre). */
export async function searchAvailable({ search, limit }, db = pool) {
  const patron = `%${escapeLike(search)}%`;
  const [filas] = await db.query(
    `SELECT p.id, p.code, p.name, p.price, p.stock
     FROM parts p
     WHERE p.active = 1 AND p.stock > 0 AND (p.code LIKE ? OR p.name LIKE ?)
     ORDER BY p.name ASC, p.id ASC LIMIT ?`,
    [patron, patron, limit]
  );
  return filas.map((f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    price: Number(f.price),
    stock: f.stock
  }));
}

/** Conteo de refacciones activas con stock bajo y agotadas (para la insignia del menú). */
export async function countAlerts(db = pool) {
  const [[fila]] = await db.query(
    `SELECT
       COALESCE(SUM(p.stock > 0 AND p.stock <= p.minimum_stock), 0) AS low,
       COALESCE(SUM(p.stock = 0), 0) AS out_of_stock
     FROM parts p WHERE p.active = 1`
  );
  const low = Number(fila.low);
  const out = Number(fila.out_of_stock);
  return { low, out, total: low + out };
}
