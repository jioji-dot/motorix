// La política de contraseñas existente se mantiene al crear usuarios y al cambiar la contraseña (Sprint 7, FR-027).
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { CONTRASENA_PRUEBA, cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const alta = (password, n) => request(app).post('/api/users').set(auth(usuarios.ADMIN))
  .send({ username: `usuario.${n}`, name: 'Prueba', email: `u${n}@motorix.test`, role: 'MECHANIC', password });
const cambio = (newPassword) => request(app).post('/api/auth/change-password').set(auth(usuarios.RECEPTIONIST))
  .send({ currentPassword: CONTRASENA_PRUEBA, newPassword });

const INVALIDAS = [['Ab1', 'corta', /8 caracteres/], ['minuscula1', 'sin mayúscula', /mayúscula/], ['MAYUSCULA1', 'sin minúscula', /minúscula/], ['SinNumeroAqui', 'sin número', /número/]];

test.each(INVALIDAS)('al_crear_un_usuario_se_rechaza_%j_(%s)_con_un_mensaje_claro', async (clave, _motivo, mensaje) => {
  const r = await alta(clave, clave.length);
  expect(r.status).toBe(400);
  expect(r.body.error.details.map((d) => d.message).join(' ')).toMatch(mensaje);
});

test.each(INVALIDAS)('al_cambiar_la_contrasena_se_rechaza_%j_(%s)', async (clave, _motivo, mensaje) => {
  const r = await cambio(clave);
  expect(r.status).toBe(400);
  expect(r.body.error.details.map((d) => d.message).join(' ')).toMatch(mensaje);
});

test('una_contrasena_valida_se_acepta_y_se_guarda_solo_con_hash', async () => {
  const r = await alta('ValidaClave1', 'ok');
  expect(r.status).toBe(201);
  const [[fila]] = await pool.query("SELECT passwordHash FROM users WHERE username = 'usuario.ok'");
  expect(fila.passwordHash).not.toContain('ValidaClave1');
  expect(await bcrypt.compare('ValidaClave1', fila.passwordHash)).toBe(true);
  expect((await cambio('OtraClave2026')).status).toBe(204);
});
