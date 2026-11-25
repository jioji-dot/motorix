// Avisos hechos a clientes con consultas parametrizadas (Sprint 6, FR-017 a FR-019).
// La unicidad por (tipo de hecho, hecho) la garantiza la base de datos.
import { pool } from '../config/db.js';

function toNotice(fila) {
  return {
    id: fila.id,
    kind: fila.kind,
    factId: fila.factId,
    client: { id: fila.clientId, name: fila.clientName },
    noticedBy: { id: fila.noticedBy, name: fila.noticedByName },
    noticedAt: fila.noticedAt,
    note: fila.note,
  };
}

export async function findByFact(kind, factId, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT n.id, n.clientId, n.kind, n.factId, n.note, n.noticedAt, n.noticedBy,
            u.name AS noticedByName, c.name AS clientName
       FROM client_notices n
       JOIN users   u ON u.id = n.noticedBy
       JOIN clients c ON c.id = n.clientId
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

// Datos mínimos de una orden para decidir si su hecho «vehículo listo» sigue aplicando.
export async function findOrderFact(id) {
  const [filas] = await pool.execute(
    `SELECT o.id, o.status, o.clientId, c.active
       FROM service_orders o JOIN clients c ON c.id = o.clientId WHERE o.id = ?`,
    [id],
  );
  return filas[0] ? { clientId: filas[0].clientId, status: filas[0].status, clientActive: Boolean(filas[0].active) } : null;
}

// Datos mínimos de una cita; `isOnDay` indica si es del día ('YYYY-MM-DD') en que se quiere avisar.
export async function findAppointmentFact(id, dia) {
  const [filas] = await pool.execute(
    `SELECT a.id, a.status, a.clientId, c.active,
            (a.scheduledAt >= ? AND a.scheduledAt < DATE_ADD(?, INTERVAL 1 DAY)) AS isOnDay
       FROM appointments a JOIN clients c ON c.id = a.clientId WHERE a.id = ?`,
    [`${dia} 00:00:00`, `${dia} 00:00:00`, id],
  );
  if (!filas[0]) return null;
  return { clientId: filas[0].clientId, status: filas[0].status, clientActive: Boolean(filas[0].active), isOnDay: Boolean(filas[0].isOnDay) };
}
