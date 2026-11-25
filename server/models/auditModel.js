// Bitácora de acciones sensibles (Sprint 7, FR-024, FR-025). Solo se puede insertar y consultar: no hay edición ni borrado.
import { pool } from '../config/db.js';

export async function insert(conexion, { userId = null, actorLabel = null, action, entity = null, entityId = null, detail = null }) {
  await (conexion ?? pool).execute(
    'INSERT INTO audit_log (userId, actorLabel, action, entity, entityId, detail) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, actorLabel, action, entity, entityId, detail === null ? null : JSON.stringify(detail)],
  );
}

export async function list({ from, to, userId, action, page = 1, pageSize = 50 }) {
  const condiciones = [];
  const parametros = [];
  if (from) {
    condiciones.push('a.createdAt >= ?');
    parametros.push(`${from} 00:00:00`);
  }
  if (to) {
    condiciones.push('a.createdAt < DATE_ADD(?, INTERVAL 1 DAY)');
    parametros.push(`${to} 00:00:00`);
  }
  if (userId !== undefined) {
    condiciones.push('a.userId = ?');
    parametros.push(userId);
  }
  if (action) {
    condiciones.push('a.action = ?');
    parametros.push(action);
  }
  const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_log a ${donde}`, parametros);
  const [filas] = await pool.query(
    `SELECT a.id, a.action, a.entity, a.entityId, a.userId, u.name AS userName, a.actorLabel, a.detail, a.createdAt
       FROM audit_log a LEFT JOIN users u ON u.id = a.userId ${donde}
      ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...parametros, pageSize, (page - 1) * pageSize],
  );
  return {
    total,
    items: filas.map((f) => ({
      id: f.id,
      action: f.action,
      entity: f.entity,
      entityId: f.entityId,
      user: f.userId ? { id: f.userId, name: f.userName } : null,
      actorLabel: f.actorLabel,
      detail: typeof f.detail === 'string' ? JSON.parse(f.detail) : f.detail,
      createdAt: f.createdAt,
    })),
  };
}
