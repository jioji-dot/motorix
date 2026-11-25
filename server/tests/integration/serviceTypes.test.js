// Catálogo de tipos de servicio (Sprint 7, FR-005, FR-006, FR-024).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const crear = (u, cuerpo) => request(app).post('/api/service-types').set(auth(u)).send(cuerpo);
const listar = (u) => request(app).get('/api/service-types').set(auth(u));

test('sin_sesion_401', async () => {
  expect((await request(app).get('/api/service-types')).status).toBe(401);
});

test('el_administrador_crea_con_intervalos_validos', async () => {
  const r = await crear(usuarios.ADMIN, { name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 });
  expect(r.status).toBe(201);
  expect(r.body.data).toEqual({ id: expect.any(Number), name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000, active: true });
  const soloKm = await crear(usuarios.ADMIN, { name: 'Afinación', intervalKm: 10000 });
  expect(soloKm.status).toBe(201);
  expect(soloKm.body.data.intervalDays).toBeNull();
});

test('sin_ningun_intervalo_o_fuera_de_rango_responde_400', async () => {
  for (const cuerpo of [
    { name: 'Sin intervalo' },
    { name: 'Cero', intervalDays: 0 },
    { name: 'Muy largo', intervalDays: 3651 },
    { name: 'Muchos km', intervalKm: 1000001 },
    { name: '', intervalDays: 10 },
    { name: 'x'.repeat(101), intervalDays: 10 },
    { name: 'Decimal', intervalDays: 1.5 },
  ]) {
    const r = await crear(usuarios.ADMIN, cuerpo);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  }
});

test('un_nombre_repetido_sin_distinguir_mayusculas_responde_409', async () => {
  const r = await crear(usuarios.ADMIN, { name: 'CAMBIO DE ACEITE', intervalDays: 10 });
  expect(r.status).toBe(409);
  expect(r.body.error.code).toBe('SERVICE_TYPE_DUPLICATE');
});

test('editar_y_desactivar_no_borra', async () => {
  const id = (await listar(usuarios.ADMIN)).body.data.find((t) => t.name === 'Afinación').id;
  const editado = await request(app).patch(`/api/service-types/${id}`).set(auth(usuarios.ADMIN)).send({ intervalDays: 365 });
  expect(editado.status).toBe(200);
  expect(editado.body.data).toMatchObject({ intervalDays: 365, intervalKm: 10000 });
  const off = await request(app).patch(`/api/service-types/${id}`).set(auth(usuarios.ADMIN)).send({ active: false });
  expect(off.body.data.active).toBe(false);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM service_types');
  expect(n).toBe(2);
});

test('editar_con_nombre_repetido_responde_409_y_un_id_inexistente_404', async () => {
  const id = (await listar(usuarios.ADMIN)).body.data.find((t) => t.name === 'Afinación').id;
  expect((await request(app).patch(`/api/service-types/${id}`).set(auth(usuarios.ADMIN)).send({ name: 'cambio de aceite' })).status).toBe(409);
  expect((await request(app).patch('/api/service-types/99999').set(auth(usuarios.ADMIN)).send({ active: true })).status).toBe(404);
});

test('el_administrador_ve_todos_y_recepcion_y_mecanico_solo_los_activos', async () => {
  expect((await listar(usuarios.ADMIN)).body.data).toHaveLength(2);
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) {
    const r = await listar(u);
    expect(r.status).toBe(200);
    expect(r.body.data.map((t) => t.name)).toEqual(['Cambio de aceite']);
  }
});

test('recepcion_y_mecanico_reciben_403_al_crear_y_editar', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) {
    expect((await crear(u, { name: 'Nuevo', intervalDays: 5 })).status).toBe(403);
    expect((await request(app).patch('/api/service-types/1').set(auth(u)).send({ active: false })).status).toBe(403);
  }
});

test('cada_alta_y_cambio_queda_en_la_bitacora', async () => {
  const [filas] = await pool.query("SELECT action FROM audit_log WHERE action LIKE 'SERVICE_TYPE_%' ORDER BY id");
  expect(filas.map((f) => f.action)).toEqual(['SERVICE_TYPE_CREATED', 'SERVICE_TYPE_CREATED', 'SERVICE_TYPE_UPDATED', 'SERVICE_TYPE_UPDATED']);
});
