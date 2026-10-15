// Recrea la base de datos local desde cero: elimina las tablas, aplica migraciones y carga seeds.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openConnection, runMigrations } from './migrate.js';
import { runSeeds } from './seed.js';

/** Elimina todas las tablas de la base configurada (solo entornos locales). */
export async function dropAllTables(connection) {
  const [tablas] = await connection.query(
    'SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { nombre } of tablas) {
    await connection.query(`DROP TABLE IF EXISTS \`${nombre}\``);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('db:reset no puede ejecutarse con NODE_ENV=production.');
    process.exit(1);
  }
  const connection = await openConnection();
  try {
    await dropAllTables(connection);
    await runMigrations(connection);
    await runSeeds(connection);
    console.log('Base de datos recreada desde cero con migraciones y datos de ejemplo.');
  } catch (error) {
    console.error(`Error al recrear la base de datos: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}
