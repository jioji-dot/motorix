// Lecturas de avisos por usuario con consultas parametrizadas. Los avisos no se guardan: solo su lectura (Sprint 6, FR-003).
import { pool } from '../config/db.js';

export async function listReads(userId) {
  const [filas] = await pool.execute('SELECT noticeKey FROM notification_reads WHERE userId = ? ORDER BY noticeKey', [userId]);
  return filas.map((fila) => fila.noticeKey);
}

// Idempotente: leer dos veces el mismo aviso no duplica ni falla.
export async function saveRead(userId, noticeKey) {
  await pool.execute('INSERT IGNORE INTO notification_reads (userId, noticeKey) VALUES (?, ?)', [userId, noticeKey]);
}

// Borra las lecturas del usuario cuyas claves ya no corresponden a un aviso vigente.
export async function deleteReads(userId, keys) {
  if (keys.length === 0) return;
  await pool.query('DELETE FROM notification_reads WHERE userId = ? AND noticeKey IN (?)', [userId, keys]);
}
