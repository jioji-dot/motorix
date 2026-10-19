// Crea o actualiza una cuenta de administrador. La contraseña se recibe por entorno y se guarda con bcrypt.
//
// Uso (PowerShell):
//   $env:ADMIN_PASSWORD = '<contraseña>'
//   node scripts/create-admin.js --username admin --name "Administrador" --email admin@taller.mx
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import * as userModel from '../models/userModel.js';
import { passwordSchema } from '../validators/authValidator.js';

function leerArgumentos(argv) {
  const argumentos = {};
  for (let i = 0; i < argv.length; i += 2) {
    argumentos[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return argumentos;
}

async function main() {
  const { username, name, email } = leerArgumentos(process.argv.slice(2));
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !name || !email || !password) {
    console.error('Uso: define ADMIN_PASSWORD y pasa --username, --name y --email.');
    process.exitCode = 1;
    return;
  }

  const politica = passwordSchema.safeParse(password);
  if (!politica.success) {
    console.error(`La contraseña no cumple la política: ${politica.error.issues[0].message}`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await userModel.upsert({ username, name, email, role: 'ADMIN', passwordHash });
  console.log(`Administrador "${username}" creado o actualizado.`);
}

main()
  .catch((error) => {
    console.error('No se pudo crear el administrador:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
