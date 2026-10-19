// Carga los datos de ejemplo del Sprint 1. Es idempotente: ejecutarlo de nuevo no duplica registros.
//
// - Usuarios: cuentas iniciales (admin, recepcion, mecanico) con hash bcrypt. Las contraseñas del estándar
//   del MVP se leen de variables de entorno locales (SEED_PASSWORD_ADMIN, SEED_PASSWORD_RECEPCION y
//   SEED_PASSWORD_MECANICO); nunca están escritas en el código ni en el repositorio.
// - Clientes y vehículos: scripts SQL de database/seeds/ (también idempotentes).
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import * as userModel from '../models/userModel.js';

const carpetaSeeds = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'database', 'seeds');

const CUENTAS_INICIALES = [
  { username: 'admin', name: 'Administrador del taller', email: 'admin@motorix.mx', role: 'ADMIN', variable: 'SEED_PASSWORD_ADMIN' },
  { username: 'recepcion', name: 'Recepción del taller', email: 'recepcion@motorix.mx', role: 'RECEPTIONIST', variable: 'SEED_PASSWORD_RECEPCION' },
  { username: 'mecanico', name: 'Mecánico del taller', email: 'mecanico@motorix.mx', role: 'MECHANIC', variable: 'SEED_PASSWORD_MECANICO' },
];

async function cargarUsuarios() {
  const faltantes = CUENTAS_INICIALES.filter((cuenta) => !process.env[cuenta.variable]).map((c) => c.variable);
  if (faltantes.length > 0) {
    throw new Error(
      `Faltan las variables ${faltantes.join(', ')} en tu .env. Consulta las cuentas del estándar en docs/project-context.md.`,
    );
  }
  for (const cuenta of CUENTAS_INICIALES) {
    const passwordHash = await bcrypt.hash(process.env[cuenta.variable], 10);
    const nuevo = await userModel.insertIfMissing({ ...cuenta, passwordHash });
    console.log(`Usuario ${cuenta.username}: ${nuevo ? 'creado' : 'ya existía'}`);
  }
}

async function cargarScriptsSql() {
  const archivos = (await fs.readdir(carpetaSeeds)).filter((nombre) => nombre.endsWith('.sql')).sort();
  if (archivos.length === 0) return;

  const conexion = await mysql.createConnection({
    host: env.db.host === 'localhost' ? '127.0.0.1' : env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    charset: 'utf8mb4',
    multipleStatements: true,
  });
  try {
    for (const archivo of archivos) {
      const sql = await fs.readFile(path.join(carpetaSeeds, archivo), 'utf8');
      await conexion.query(sql);
      console.log(`Seed aplicado: ${archivo}`);
    }
  } finally {
    await conexion.end();
  }
}

async function main() {
  console.log(`Cargando datos de ejemplo en la base "${env.db.database}"...`);
  await cargarUsuarios();
  await cargarScriptsSql();
  console.log('Listo.');
}

main()
  .catch((error) => {
    console.error('No se pudieron cargar los datos de ejemplo:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
