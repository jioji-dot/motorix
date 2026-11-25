// Avisos hechos a clientes con consultas parametrizadas (Sprint 6, FR-017 a FR-019).
// La unicidad por (tipo de hecho, hecho) la garantiza la base de datos.
import { pool } from '../config/db.js';

function toNotice(fila) {
  return {
    id: fila.id,
    clientId: fila.clientId,
    kind: fila.kind,
    factId: fila.factId,
    note: fila.note,
    noticedAt: fila.noticedAt,
    noticedBy: { id: fila.noticedBy, name: fila.noticedByName },
  };
}

export async function findByFact(kind, factId, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT n.id, n.clientId, n.kind, n.factId, n.note, n.noticedAt, n.noticedBy, u.name AS noticedByName
       FROM client_notices n JOIN users u ON u.id = n.noticedBy
      WHERE n.kind = ? AND n.factId = ?`,
    [kind, factId],
  );
  return filas[0] ? toNotice(filas[0]) : null;
}

// Crea el aviso si el hecho aún no tiene uno; si ya existe, no cambia nada. `conexion` null usa el pool.
export async function insertIfAbsent(conexion, { clientId, kind, factId, noticedBy, note = null }) {
  const [resultado] = await (conexion ?? pool).execute(
    'INSERT IGNORE INTO client_notices (clientId, kind, factId, noticedBy, note) VALUES (?, ?, ?, ?, ?)',
    [clientId, kind, factId, noticedBy, note ?? null],
  );
  return { created: resultado.affectedRows === 1 };
}

// Hechos ya avisados, para excluirlos de la lista pendiente.
export async function listNoticed() {
  const [filas] = await pool.query('SELECT kind, factId FROM client_notices');
  return filas.map((fila) => ({ kind: fila.kind, factId: fila.factId }));
}
