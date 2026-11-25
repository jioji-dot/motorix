// Cierre de sesión por inactividad validado en el servidor (Sprint 7, FR-028).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { CONTRASENA_PRUEBA, cerrarConexiones, crearUsuariosDePrueba, fijarActividad, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const marca = async (u) => (await pool.query('SELECT lastActivityAt FROM users WHERE id = ?', [u.id]))[0][0].lastActivityAt;
const clientes = (u) => request(app).get('/api/clients').set(auth(u));

test('una_marca_nula_se_trata_como_vigente_y_la_primera_peticion_la_fija', async () => {
  expect(await marca(usuarios.RECEPTIONIST)).toBeNull();
  expect((await clientes(usuarios.RECEPTIONIST)).status).toBe(200);
  expect(await marca(usuarios.RECEPTIONIST)).not.toBeNull();
});

test('con_mas_de_30_minutos_responde_401_SESSION_INACTIVE', async () => {
  await fijarActividad(usuarios.RECEPTIONIST.id, 31);
  const r = await clientes(usuarios.RECEPTIONIST);
  expect(r.status).toBe(401);
  expect(r.body.error.code).toBe('SESSION_INACTIVE');
});

test('con_29_minutos_la_sesion_sigue_vigente_y_se_refresca', async () => {
  await fijarActividad(usuarios.RECEPTIONIST.id, 29);
  expect((await clientes(usuarios.RECEPTIONIST)).status).toBe(200);
  const [[{ minutos }]] = await pool.query('SELECT TIMESTAMPDIFF(SECOND, lastActivityAt, NOW()) AS minutos FROM users WHERE id = ?', [usuarios.RECEPTIONIST.id]);
  expect(minutos).toBeLessThan(5);
});

test('la_marca_reciente_no_se_reescribe_en_cada_peticion', async () => {
  await fijarActividad(usuarios.MECHANIC.id, 0);
  const antes = await marca(usuarios.MECHANIC);
  await request(app).get('/api/clients').set(auth(usuarios.MECHANIC));
  expect((await marca(usuarios.MECHANIC)).getTime()).toBe(antes.getTime());
});

test('la_consulta_automatica_de_avisos_no_mantiene_viva_la_sesion', async () => {
  await fijarActividad(usuarios.ADMIN.id, 10);
  const antes = await marca(usuarios.ADMIN);
  expect((await request(app).get('/api/notifications').set(auth(usuarios.ADMIN))).status).toBe(200);
  expect((await marca(usuarios.ADMIN)).getTime()).toBe(antes.getTime());
  await fijarActividad(usuarios.ADMIN.id, 31);
  expect((await request(app).get('/api/notifications').set(auth(usuarios.ADMIN))).status).toBe(401);
});

test('iniciar_sesion_fija_la_marca_y_permite_volver_a_entrar_tras_la_inactividad', async () => {
  await fijarActividad(usuarios.RECEPTIONIST.id, 120);
  const login = await request(app).post('/api/auth/login').send({ identifier: 'recepcion', password: CONTRASENA_PRUEBA });
  expect(login.status).toBe(200);
  const [[{ segundos }]] = await pool.query('SELECT TIMESTAMPDIFF(SECOND, lastActivityAt, NOW()) AS segundos FROM users WHERE id = ?', [usuarios.RECEPTIONIST.id]);
  expect(segundos).toBeLessThan(5);
  const r = await request(app).get('/api/clients').set({ Authorization: `Bearer ${login.body.data.token}` });
  expect(r.status).toBe(200);
});
