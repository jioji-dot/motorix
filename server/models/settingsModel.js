// Configuración clave-valor con consultas parametrizadas (Sprint 7, FR-001, FR-003).
import { pool } from '../config/db.js';

export async function getAll() {
  const [filas] = await pool.query('SELECT settingKey, settingValue FROM settings');
  return Object.fromEntries(filas.map((f) => [f.settingKey, f.settingValue]));
}

// Guarda (inserta o actualiza) varios valores en una sola transacción.
export async function saveMany(pares, userId) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    for (const [clave, valor] of Object.entries(pares)) {
      await conexion.execute(
        `INSERT INTO settings (settingKey, settingValue, updatedBy) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedBy = VALUES(updatedBy)`,
        [clave, String(valor), userId ?? null],
      );
    }
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
