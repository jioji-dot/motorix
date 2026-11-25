// Versiones de términos y aceptaciones con consultas parametrizadas (Sprint 7, FR-018, FR-020, FR-022).
import { pool } from '../config/db.js';

// Versión vigente (la de mayor número) o nulo si no hay ninguna publicada.
export async function current(conexion = pool) {
  const [filas] = await conexion.query(
    'SELECT version, termsText, privacyText, publishedBy, publishedAt FROM terms_versions ORDER BY version DESC LIMIT 1',
  );
  return filas[0] ?? null;
}

export async function publish({ termsText, privacyText, userId }) {
  const [r] = await pool.execute('INSERT INTO terms_versions (termsText, privacyText, publishedBy) VALUES (?, ?, ?)', [
    termsText,
    privacyText,
    userId ?? null,
  ]);
  return r.insertId;
}

export async function accept(userId, version) {
  await pool.execute('INSERT IGNORE INTO terms_acceptances (userId, version) VALUES (?, ?)', [userId, version]);
}

export async function hasAccepted(userId, version, conexion = pool) {
  const [filas] = await conexion.execute('SELECT 1 FROM terms_acceptances WHERE userId = ? AND version = ?', [userId, version]);
  return filas.length > 0;
}

// Quién aceptó y quién no la versión indicada (solo usuarios activos).
export async function acceptances(version) {
  const [filas] = await pool.execute(
    `SELECT u.id AS userId, u.name, a.acceptedAt
       FROM users u LEFT JOIN terms_acceptances a ON a.userId = u.id AND a.version = ?
      WHERE u.active = 1 ORDER BY u.name, u.id`,
    [version],
  );
  return {
    accepted: filas.filter((f) => f.acceptedAt).map((f) => ({ userId: f.userId, name: f.name, acceptedAt: f.acceptedAt })),
    pending: filas.filter((f) => !f.acceptedAt).map((f) => ({ userId: f.userId, name: f.name })),
  };
}
