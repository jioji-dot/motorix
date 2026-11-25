// Bitácora de acciones sensibles y su consulta (Sprint 7, FR-024, FR-025, FR-026, SC-005).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearPago, crearRefaccion, crearUsuariosDePrueba, limpiarBase,
} from '../helpers.js';

let usuarios;
const CLAVE_ERRONEA = 'ClaveEquivocada9';
const CLAVE_NUEVA = 'Segura2026a';

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const acciones = async () => (await pool.query('SELECT action FROM audit_log ORDER BY id'))[0].map((f) => f.action);
const bitacora = (u, consulta = '') => request(app).get(`/api/audit-log${consulta}`).set(auth(u));

test('inicios_de_sesion_fallidos_y_bloqueo_se_registran_con_el_identificador_escrito', async () => {
  await request(app).post('/api/auth/login').send({ identifier: 'no.existe', password: CLAVE_ERRONEA });
  for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/login').send({ identifier: 'mecanico', password: CLAVE_ERRONEA });
  const todas = await acciones();
  expect(todas.filter((a) => a === 'LOGIN_FAILED')).toHaveLength(6);
  expect(todas).toContain('ACCOUNT_LOCKED');
  const [[intruso]] = await pool.query("SELECT userId, actorLabel FROM audit_log WHERE actorLabel = 'no.existe'");
  expect(intruso.userId).toBeNull();
  const [[conocido]] = await pool.query("SELECT userId FROM audit_log WHERE actorLabel = 'mecanico' LIMIT 1");
  expect(conocido.userId).toBe(usuarios.MECHANIC.id);
});

test('alta_cambio_de_rol_baja_y_reactivacion_de_usuarios', async () => {
  const alta = await request(app).post('/api/users').set(auth(usuarios.ADMIN))
    .send({ username: 'nuevo.usuario', name: 'Nuevo', email: 'nuevo@motorix.test', role: 'MECHANIC', password: CLAVE_NUEVA });
  const id = alta.body.data.id;
  await request(app).patch(`/api/users/${id}`).set(auth(usuarios.ADMIN)).send({ role: 'RECEPTIONIST' });
  await request(app).patch(`/api/users/${id}`).set(auth(usuarios.ADMIN)).send({ active: false });
  await request(app).patch(`/api/users/${id}`).set(auth(usuarios.ADMIN)).send({ active: true });
  const todas = await acciones();
  for (const a of ['USER_CREATED', 'USER_ROLE_CHANGED', 'USER_DEACTIVATED', 'USER_REACTIVATED']) expect(todas).toContain(a);
  const [[rol]] = await pool.query("SELECT detail, userId, entityId FROM audit_log WHERE action = 'USER_ROLE_CHANGED'");
  expect(typeof rol.detail === 'string' ? JSON.parse(rol.detail) : rol.detail).toEqual({ from: 'MECHANIC', to: 'RECEPTIONIST' });
  expect(rol.userId).toBe(usuarios.ADMIN.id);
  expect(rol.entityId).toBe(id);
});

test('cambios_de_precio_de_refaccion_y_pago_cancelado', async () => {
  const parte = await crearRefaccion({ stock: 5, minimumStock: 1, purchasePrice: 50, salePrice: 100 });
  const r = await request(app).patch(`/api/parts/${parte.id}`).set(auth(usuarios.ADMIN)).send({ salePrice: 150 });
  expect(r.status).toBe(200);
  const c = await crearClienteConVehiculo();
  const orden = await crearOrdenCobrable({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  const pago = await crearPago({ orderId: orden, createdBy: usuarios.ADMIN.id, status: 'PENDIENTE', method: 'MERCADO_PAGO', amount: 300 });
  const cancelado = await request(app).post(`/api/payments/${pago}/cancel`).set(auth(usuarios.RECEPTIONIST));
  expect(cancelado.status).toBe(200);
  const [[precio]] = await pool.query("SELECT detail FROM audit_log WHERE action = 'PART_PRICE_CHANGED'");
  expect(typeof precio.detail === 'string' ? JSON.parse(precio.detail) : precio.detail).toMatchObject({ field: 'salePrice', from: '100.00', to: '150.00' });
  const [[cancel]] = await pool.query("SELECT detail, userId FROM audit_log WHERE action = 'PAYMENT_CANCELLED'");
  expect(cancel.userId).toBe(usuarios.RECEPTIONIST.id);
  expect(typeof cancel.detail === 'string' ? JSON.parse(cancel.detail) : cancel.detail).toMatchObject({ orderId: orden });
});

test('solo_el_administrador_consulta_la_bitacora_y_recepcion_y_mecanico_reciben_403', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) expect((await bitacora(u)).status).toBe(403);
  expect((await request(app).get('/api/audit-log')).status).toBe(401);
});

test('la_consulta_ordena_de_la_mas_reciente_filtra_y_pagina', async () => {
  const todas = await bitacora(usuarios.ADMIN, '?pageSize=100');
  expect(todas.status).toBe(200);
  const ids = todas.body.data.map((e) => e.id);
  expect(ids).toEqual([...ids].sort((a, b) => b - a));
  expect(todas.body.meta).toMatchObject({ page: 1, pageSize: 100, total: ids.length });

  const pagina = await bitacora(usuarios.ADMIN, '?pageSize=3&page=2');
  expect(pagina.body.data).toHaveLength(3);
  const fallidos = await bitacora(usuarios.ADMIN, '?action=LOGIN_FAILED&pageSize=100');
  expect(fallidos.body.data.every((e) => e.action === 'LOGIN_FAILED')).toBe(true);
  const delAdmin = await bitacora(usuarios.ADMIN, `?userId=${usuarios.ADMIN.id}&pageSize=100`);
  expect(delAdmin.body.data.every((e) => e.user?.id === usuarios.ADMIN.id)).toBe(true);
  const hoy = new Date().toISOString().slice(0, 10);
  expect((await bitacora(usuarios.ADMIN, `?from=${hoy}&to=${hoy}&pageSize=100`)).body.meta.total).toBeGreaterThan(0);
  expect((await bitacora(usuarios.ADMIN, '?from=2000-01-01&to=2000-01-02')).body.meta.total).toBe(0);
  expect((await bitacora(usuarios.ADMIN, '?action=NO_EXISTE')).status).toBe(400);
  expect((await bitacora(usuarios.ADMIN, '?from=ayer')).status).toBe(400);
  expect((await bitacora(usuarios.ADMIN, '?pageSize=500')).status).toBe(400);
});

test('no_hay_rutas_para_editar_borrar_ni_exportar_la_bitacora', async () => {
  for (const [metodo, ruta] of [['post', '/api/audit-log'], ['put', '/api/audit-log/1'], ['patch', '/api/audit-log/1'], ['delete', '/api/audit-log/1'], ['get', '/api/audit-log/export']]) {
    expect((await request(app)[metodo](ruta).set(auth(usuarios.ADMIN)).send({})).status).toBe(404);
  }
});

test('ninguna_entrada_contiene_contrasenas_hashes_ni_tokens', async () => {
  const [filas] = await pool.query('SELECT * FROM audit_log');
  const texto = JSON.stringify(filas);
  for (const prohibido of [CLAVE_ERRONEA, CLAVE_NUEVA, 'Prueba2026!', 'passwordHash', '$2a$', '$2b$', usuarios.ADMIN.token, 'cardNumber']) {
    expect(texto).not.toContain(prohibido);
  }
  const respuesta = JSON.stringify((await bitacora(usuarios.ADMIN, '?pageSize=100')).body);
  expect(respuesta).not.toMatch(/passwordHash|\$2[ab]\$|Bearer/);
});
