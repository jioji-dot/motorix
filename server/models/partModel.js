// Acceso a datos del catálogo de refacciones con consultas parametrizadas.
import { pool } from '../config/db.js';
import { escaparLike } from '../validators/commonValidator.js';

const CAMPOS = `p.id, p.code, p.name, p.category, p.brand, p.stock, p.minimumStock, p.purchasePrice, p.salePrice,
                p.active, p.createdAt, p.updatedAt`;

// Nivel de stock derivado (solo refacciones activas): OUT si no hay piezas, LOW si llegó al mínimo, OK en otro caso.
export function stockLevelOf({ stock, minimumStock, active }) {
  if (!active) return null;
  if (stock === 0) return 'OUT';
  return stock <= minimumStock ? 'LOW' : 'OK';
}

function toPart(fila) {
  const parte = { ...fila, active: Boolean(fila.active) };
  return { ...parte, stockLevel: stockLevelOf(parte) };
}

export async function findById(id, conexion = pool) {
  const [filas] = await conexion.execute(`SELECT ${CAMPOS} FROM parts p WHERE p.id = ?`, [id]);
  return filas[0] ? toPart(filas[0]) : null;
}

export async function findByCode(code, conexion = pool) {
  const [filas] = await conexion.execute('SELECT id, code FROM parts WHERE code = ? LIMIT 1', [code]);
  return filas[0] ?? null;
}

export async function create(conexion, datos) {
  const [resultado] = await conexion.execute(
    `INSERT INTO parts (code, name, category, brand, stock, minimumStock, purchasePrice, salePrice)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    [datos.code, datos.name, datos.category, datos.brand, datos.minimumStock, datos.purchasePrice, datos.salePrice],
  );
  return resultado.insertId;
}

const CAMPOS_EDITABLES = ['name', 'category', 'brand', 'minimumStock', 'purchasePrice', 'salePrice', 'active'];

export async function update(id, datos) {
  const asignaciones = [];
  const parametros = [];
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      parametros.push(campo === 'active' ? (datos[campo] ? 1 : 0) : datos[campo]);
    }
  }
  if (asignaciones.length > 0) {
    await pool.execute(`UPDATE parts SET ${asignaciones.join(', ')} WHERE id = ?`, [...parametros, id]);
  }
}

export async function list({ search, category, stockLevel, active, page, pageSize }) {
  const condiciones = [];
  const parametros = [];

  if (active === 'true') condiciones.push('p.active = 1');
  if (active === 'false') condiciones.push('p.active = 0');
  if (search) {
    const patron = `%${escaparLike(search)}%`;
    condiciones.push('(p.code LIKE ? OR p.name LIKE ? OR p.category LIKE ? OR p.brand LIKE ?)');
    parametros.push(patron, patron, patron, patron);
  }
  if (category) {
    condiciones.push('p.category = ?');
    parametros.push(category);
  }
  if (stockLevel) {
    // Las alertas solo cuentan refacciones activas.
    const niveles = [];
    if (stockLevel.includes('OUT')) niveles.push('p.stock = 0');
    if (stockLevel.includes('LOW')) niveles.push('(p.stock > 0 AND p.stock <= p.minimumStock)');
    condiciones.push(`p.active = 1 AND (${niveles.join(' OR ')})`);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM parts p ${donde}`, parametros);
  const [filas] = await pool.query(`SELECT ${CAMPOS} FROM parts p ${donde} ORDER BY p.name ASC, p.id ASC LIMIT ? OFFSET ?`, [
    ...parametros,
    pageSize,
    (page - 1) * pageSize,
  ]);
  return { items: filas.map(toPart), total };
}

export async function categories() {
  const [filas] = await pool.query('SELECT DISTINCT category FROM parts WHERE active = 1 ORDER BY category');
  return filas.map((fila) => fila.category);
}

// Resumen de alertas: solo refacciones activas.
export async function summary() {
  const [[fila]] = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(stock = 0), 0) AS \`out\`,
            COALESCE(SUM(stock > 0 AND stock <= minimumStock), 0) AS low
       FROM parts WHERE active = 1`,
  );
  const total = Number(fila.total);
  const out = Number(fila.out);
  const low = Number(fila.low);
  return { total, ok: total - out - low, low, out };
}
