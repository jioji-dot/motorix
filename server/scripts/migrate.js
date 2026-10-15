// Aplica las migraciones SQL de database/migrations/ de forma idempotente.
// Registra cada archivo en `schema_migrations` con su checksum SHA-256 y se niega a continuar
// si un archivo ya aplicado fue modificado (las migraciones son inmutables).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

/** Abre una conexión que admite varias sentencias por archivo, con la configuración del entorno. */
export async function openConnection() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_USER || !DB_NAME) {
    throw new Error(
      'Faltan variables de entorno de la base de datos (DB_HOST, DB_PORT, DB_USER, DB_NAME). ' +
        'Copia .env.example a .env y completa los valores.'
    );
  }
  return mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD || '',
    database: DB_NAME,
    charset: 'utf8mb4',
    multipleStatements: true
  });
}

/**
 * Aplica las migraciones pendientes.
 * @returns {Promise<string[]>} nombres de los archivos aplicados en esta ejecución
 */
export async function runMigrations(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);

  const [filas] = await connection.query('SELECT filename, checksum FROM schema_migrations');
  const aplicadas = new Map(filas.map((fila) => [fila.filename, fila.checksum]));

  const archivos = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql')).sort();
  const nuevas = [];

  for (const archivo of archivos) {
    const contenido = await readFile(path.join(MIGRATIONS_DIR, archivo), 'utf8');
    const checksum = createHash('sha256').update(contenido).digest('hex');

    if (aplicadas.has(archivo)) {
      if (aplicadas.get(archivo) !== checksum) {
        throw new Error(
          `La migración ya aplicada "${archivo}" fue modificada. ` +
            'Las migraciones son inmutables: agrega un nuevo script numerado en su lugar.'
        );
      }
      continue;
    }

    await connection.query(contenido);
    await connection.query('INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)', [
      archivo,
      checksum
    ]);
    nuevas.push(archivo);
  }

  return nuevas;
}

// Ejecución directa: `npm run db:migrate`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const connection = await openConnection();
  try {
    const nuevas = await runMigrations(connection);
    if (nuevas.length === 0) {
      console.log('La base de datos ya está actualizada. No hay migraciones pendientes.');
    } else {
      console.log(`Migraciones aplicadas: ${nuevas.join(', ')}`);
    }
  } catch (error) {
    console.error(`Error al aplicar migraciones: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}
