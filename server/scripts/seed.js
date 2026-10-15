// Carga los datos de ejemplo de forma idempotente: usuarios iniciales, clientes y vehículos.
//
// - Los usuarios se crean aquí (y no en SQL) porque sus contraseñas se cifran con bcrypt y se
//   toman de variables de entorno: nunca se guardan en el repositorio.
// - Un usuario que ya existe NO se modifica (así una contraseña cambiada desde la aplicación
//   no se sobrescribe al volver a cargar los seeds).
// - Los clientes y vehículos de ejemplo están en database/seeds/*.sql.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../utils/password.js';
import { openConnection } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SEEDS_DIR = path.resolve(__dirname, '../../database/seeds');

// Cuentas iniciales del MVP (estándar de docs/project-context.md, sección 5.1).
export const INITIAL_USERS = [
  {
    username: 'admin',
    name: 'Administrador Motorix',
    email: 'admin@motorix.local',
    role: 'ADMIN',
    passwordVariable: 'SEED_ADMIN_PASSWORD'
  },
  {
    username: 'recepcion',
    name: 'Recepción Motorix',
    email: 'recepcion@motorix.local',
    role: 'RECEPTIONIST',
    passwordVariable: 'SEED_RECEPTION_PASSWORD'
  },
  {
    username: 'mecanico',
    name: 'Mecánico Motorix',
    email: 'mecanico@motorix.local',
    role: 'MECHANIC',
    passwordVariable: 'SEED_MECHANIC_PASSWORD'
  }
];

/** Falla con un mensaje claro si falta alguna contraseña inicial. */
function leerContrasenasIniciales() {
  const faltantes = INITIAL_USERS.filter((u) => !process.env[u.passwordVariable]).map(
    (u) => u.passwordVariable
  );
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan las contraseñas iniciales en el entorno: ${faltantes.join(', ')}. ` +
        'Defínelas en tu archivo .env (los valores del estándar están en docs/project-context.md).'
    );
  }
  return Object.fromEntries(INITIAL_USERS.map((u) => [u.username, process.env[u.passwordVariable]]));
}

/** Crea los usuarios iniciales que aún no existen. @returns cantidad de usuarios creados */
async function seedUsers(connection, contrasenas) {
  let creados = 0;
  for (const usuario of INITIAL_USERS) {
    const [existentes] = await connection.query('SELECT id FROM users WHERE username = ? LIMIT 1', [
      usuario.username
    ]);
    if (existentes.length > 0) continue; // no se toca un usuario existente

    const hash = await hashPassword(contrasenas[usuario.username]);
    await connection.query(
      `INSERT INTO users (username, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [usuario.username, usuario.name, usuario.email, hash, usuario.role]
    );
    creados += 1;
  }
  return creados;
}

/**
 * Ejecuta los seeds sobre la conexión indicada. Con `hasta` (por ejemplo `'002'`) solo se cargan
 * los archivos SQL cuyo número es menor o igual; las pruebas de un sprint lo usan para comprobar
 * sus datos sin los de los sprints posteriores.
 * @returns {Promise<{ usuariosCreados: number, archivosSql: string[] }>}
 */
export async function runSeeds(connection, { hasta } = {}) {
  const contrasenas = leerContrasenasIniciales();

  await connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci');
  const usuariosCreados = await seedUsers(connection, contrasenas);

  const archivos = (await readdir(SEEDS_DIR))
    .filter((n) => n.endsWith('.sql'))
    .filter((n) => hasta === undefined || n.slice(0, 3) <= hasta)
    .sort();
  for (const archivo of archivos) {
    await connection.query(await readFile(path.join(SEEDS_DIR, archivo), 'utf8'));
  }
  return { usuariosCreados, archivosSql: archivos };
}

// Ejecución directa: `npm run db:seed`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const connection = await openConnection();
  try {
    const { usuariosCreados, archivosSql } = await runSeeds(connection);
    const [[{ clientes }]] = await connection.query('SELECT COUNT(*) AS clientes FROM clients');
    const [[{ vehiculos }]] = await connection.query('SELECT COUNT(*) AS vehiculos FROM vehicles');
    const [[{ citas }]] = await connection.query('SELECT COUNT(*) AS citas FROM appointments');
    const [[{ ordenes }]] = await connection.query('SELECT COUNT(*) AS ordenes FROM service_orders');
    const [[{ pagos }]] = await connection.query('SELECT COUNT(*) AS pagos FROM payments');
    const [[{ tickets }]] = await connection.query('SELECT COUNT(*) AS tickets FROM tickets');
    console.log(
      `Datos de ejemplo cargados (${archivosSql.join(', ')}). ` +
        `Usuarios nuevos: ${usuariosCreados}. Clientes: ${clientes}. Vehículos: ${vehiculos}. ` +
        `Citas: ${citas}. Órdenes: ${ordenes}. Pagos: ${pagos}. Tickets: ${tickets}.`
    );
  } catch (error) {
    console.error(`Error al cargar los datos de ejemplo: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}
