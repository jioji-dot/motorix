// Prepara la base `motorix_test` aplicando las migraciones antes de todas las pruebas.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  try {
    process.loadEnvFile(path.resolve(__dirname, '../../../.env.test'));
  } catch {
    // Se usan las variables del entorno si no existe .env.test.
  }
  process.env.NODE_ENV = 'test';

  // Resguardo: nunca se aplican migraciones fuera de una base "_test". Las pruebas de
  // integración y contrato vuelven a comprobarlo en tests/helpers/testDb.js y fallan.
  if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
    console.warn(
      '\nAviso: DB_NAME no termina en "_test" (valor: ' +
        `"${process.env.DB_NAME ?? 'sin definir'}"). Se omiten las migraciones de prueba. ` +
        'Crea el archivo .env.test en la raíz con DB_NAME=motorix_test.'
    );
    return;
  }

  const { openConnection, runMigrations } = await import('../../scripts/migrate.js');
  let connection;
  try {
    connection = await openConnection();
    await runMigrations(connection);
  } catch (error) {
    // Las pruebas unitarias no necesitan base de datos; las de integración fallarán por sí mismas.
    console.warn(`\nAviso: no se pudieron aplicar las migraciones en motorix_test: ${error.message}`);
  } finally {
    if (connection) await connection.end();
  }
}
