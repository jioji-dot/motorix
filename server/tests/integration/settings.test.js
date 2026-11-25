// Configuración del taller: lectura con respaldo, edición solo del administrador y bitácora (Sprint 7, FR-001, FR-004, FR-024).
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const leer = (u) => request(app).get('/api/settings').set(auth(u));
const guardar = (u, cuerpo) => request(app).put('/api/settings').set(auth(u)).send(cuerpo);

test('sin_sesion_responde_401', async () => {
  expect((await request(app).get('/api/settings')).status).toBe(401);
});

test('recepcion_y_mecanico_reciben_403_en_lectura_y_escritura', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) {
    expect((await leer(u)).status).toBe(403);
    expect((await guardar(u, { workshop: { name: 'X' } })).status).toBe(403);
  }
});

test('sin_filas_trae_los_valores_de_respaldo', async () => {
  const r = await leer(usuarios.ADMIN);
  expect(r.status).toBe(200);
  expect(r.body.data.workshop).toEqual(env.workshop);
  expect(r.body.data.maintenance).toEqual({ warnDays: 15, warnKm: 500 });
  expect(r.body.data.defaults).toEqual({ warnDays: 15, warnKm: 500 });
});

test('guardar_responde_lo_nuevo_y_lo_registra_en_la_bitacora', async () => {
  const r = await guardar(usuarios.ADMIN, { workshop: { name: 'Taller Nuevo', phone: '5511112222' }, maintenance: { warnDays: 20 } });
  expect(r.status).toBe(200);
  expect(r.body.data.workshop).toMatchObject({ name: 'Taller Nuevo', phone: '5511112222' });
  expect(r.body.data.maintenance).toEqual({ warnDays: 20, warnKm: 500 });
  expect((await leer(usuarios.ADMIN)).body.data.workshop.name).toBe('Taller Nuevo');

  const [[entrada]] = await pool.query("SELECT * FROM audit_log WHERE action = 'SETTINGS_CHANGED' ORDER BY id DESC LIMIT 1");
  expect(entrada.userId).toBe(usuarios.ADMIN.id);
  const detalle = typeof entrada.detail === 'string' ? JSON.parse(entrada.detail) : entrada.detail;
  expect(detalle.changes.map((c) => c.key).sort()).toEqual(['maintenance.warnDays', 'workshop.name', 'workshop.phone']);
});

test('valores_invalidos_responden_400_y_no_cambian_nada', async () => {
  for (const cuerpo of [
    { workshop: { name: '' } },
    { workshop: { name: 'x'.repeat(121) } },
    { maintenance: { warnDays: 0 } },
    { maintenance: { warnDays: 400 } },
    { maintenance: { warnKm: 100001 } },
  ]) {
    const r = await guardar(usuarios.ADMIN, cuerpo);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  }
  expect((await leer(usuarios.ADMIN)).body.data.workshop.name).toBe('Taller Nuevo');
});

test('un_cuerpo_con_campos_desconocidos_responde_400', async () => {
  expect((await guardar(usuarios.ADMIN, { workshop: { name: 'Ok', logo: 'x' } })).status).toBe(400);
});
