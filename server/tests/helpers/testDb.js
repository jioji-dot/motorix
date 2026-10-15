// Ayudantes de base de datos para pruebas. Incluye un resguardo contra la base principal.
import { pool } from '../../config/database.js';

export function assertTestDatabase() {
  const nombre = process.env.DB_NAME ?? '';
  if (!nombre.endsWith('_test')) {
    throw new Error(
      `Las pruebas solo pueden usar una base "_test"; DB_NAME actual: "${nombre}".`
    );
  }
}

/** Vacía las tablas funcionales (en el orden que respeta las llaves foráneas). */
export async function cleanTables() {
  assertTestDatabase();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabla of [
    'payments',
    'tickets',
    'maintenance',
    'order_parts',
    'inventory_movements',
    'parts',
    'order_status_history',
    'order_labor',
    'order_services',
    'service_orders',
    'appointments',
    'vehicles',
    'clients',
    'users'
  ]) {
    await pool.query(`TRUNCATE TABLE ${tabla}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function closePool() {
  await pool.end();
}

export { pool };
