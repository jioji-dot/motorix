// Prepara el entorno de las pruebas: carga .env y apunta SIEMPRE a la base de pruebas.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(raiz, '.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'motorix_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';

if (!process.env.DB_NAME.endsWith('_test')) {
  throw new Error(
    `Las pruebas solo pueden usar una base cuyo nombre termine en "_test" (actual: ${process.env.DB_NAME}).`,
  );
}
