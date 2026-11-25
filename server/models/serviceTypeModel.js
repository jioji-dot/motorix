// Catálogo de tipos de servicio con consultas parametrizadas (Sprint 7, FR-005, FR-006).
import { pool } from '../config/db.js';

const toType = (f) => ({
  id: f.id,
  name: f.name,
  intervalDays: f.intervalDays,
  intervalKm: f.intervalKm,
  active: Boolean(f.active),
});

export async function list({ onlyActive = false } = {}) {
  const [filas] = await pool.query(
    `SELECT id, name, intervalDays, intervalKm, active FROM service_types ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY id`,
  );
  return filas.map(toType);
}

export async function findById(id) {
  const [filas] = await pool.execute('SELECT id, name, intervalDays, intervalKm, active FROM service_types WHERE id = ?', [id]);
  return filas[0] ? toType(filas[0]) : null;
}

export async function create({ name, intervalDays, intervalKm }) {
  const [r] = await pool.execute('INSERT INTO service_types (name, intervalDays, intervalKm) VALUES (?, ?, ?)', [
    name,
    intervalDays ?? null,
    intervalKm ?? null,
  ]);
  return r.insertId;
}

const CAMPOS = { name: 'name', intervalDays: 'intervalDays', intervalKm: 'intervalKm', active: 'active' };

export async function update(id, cambios) {
  const columnas = Object.keys(cambios).filter((k) => CAMPOS[k]);
  if (columnas.length === 0) return;
  const valores = columnas.map((k) => (k === 'active' ? (cambios[k] ? 1 : 0) : (cambios[k] ?? null)));
  await pool.execute(`UPDATE service_types SET ${columnas.map((k) => `${CAMPOS[k]} = ?`).join(', ')} WHERE id = ?`, [...valores, id]);
}

// Cuántas líneas de órdenes usan el tipo.
export async function usedCount(id) {
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) AS total FROM order_services WHERE serviceTypeId = ?', [id]);
  return total;
}
