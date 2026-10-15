// Carga el entorno de pruebas (.env.test) antes de ejecutar cada archivo de pruebas.
// Las pruebas de integración y contrato usan SIEMPRE la base `motorix_test`.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.resolve(__dirname, '../../../.env.test'));
} catch {
  // Si no existe .env.test se usan las variables ya presentes en el entorno.
}

process.env.NODE_ENV = 'test';
