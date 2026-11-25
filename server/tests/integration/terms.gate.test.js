// La aceptación de términos se valida en el servidor en todas las rutas protegidas (Sprint 7, FR-021, SC-005).
import request from 'supertest';
import { app } from '../../app.js';
import * as termsModel from '../../models/termsModel.js';
import { aceptarTerminos, cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const RUTAS = ['/api/clients', '/api/vehicles', '/api/orders', '/api/appointments', '/api/parts', '/api/maintenance', '/api/notifications'];

test('sin_version_publicada_no_se_exige_nada', async () => {
  for (const ruta of RUTAS) expect((await request(app).get(ruta).set(auth(usuarios.RECEPTIONIST))).status).toBe(200);
});

test('con_version_vigente_y_sin_aceptacion_toda_ruta_protegida_responde_403_TERMS_NOT_ACCEPTED', async () => {
  await termsModel.publish({ termsText: 'T', privacyText: 'P', userId: usuarios.ADMIN.id });
  for (const ruta of RUTAS) {
    const r = await request(app).get(ruta).set(auth(usuarios.RECEPTIONIST));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('TERMS_NOT_ACCEPTED');
  }
  const escritura = await request(app).post('/api/clients').set(auth(usuarios.RECEPTIONIST)).send({ name: 'X', phone: '5512345678' });
  expect(escritura.status).toBe(403);
  expect(escritura.body.error.code).toBe('TERMS_NOT_ACCEPTED');
  const admin = await request(app).get('/api/users').set(auth(usuarios.ADMIN));
  expect(admin.body.error.code).toBe('TERMS_NOT_ACCEPTED');
});

test('las_rutas_exentas_responden_sin_aceptacion', async () => {
  expect((await request(app).get('/api/auth/me').set(auth(usuarios.RECEPTIONIST))).status).toBe(200);
  expect((await request(app).get('/api/terms/current').set(auth(usuarios.RECEPTIONIST))).status).toBe(200);
  expect((await request(app).post('/api/terms/accept').set(auth(usuarios.RECEPTIONIST))).status).toBe(200);
});

test('tras_aceptar_todo_funciona_y_los_demas_siguen_bloqueados', async () => {
  for (const ruta of RUTAS) expect((await request(app).get(ruta).set(auth(usuarios.RECEPTIONIST))).status).toBe(200);
  expect((await request(app).get('/api/clients').set(auth(usuarios.MECHANIC))).status).toBe(403);
});

test('una_version_nueva_vuelve_a_pedir_la_aceptacion', async () => {
  await termsModel.publish({ termsText: 'T2', privacyText: 'P2', userId: usuarios.ADMIN.id });
  const r = await request(app).get('/api/clients').set(auth(usuarios.RECEPTIONIST));
  expect(r.status).toBe(403);
  await aceptarTerminos(usuarios.RECEPTIONIST);
  expect((await request(app).get('/api/clients').set(auth(usuarios.RECEPTIONIST))).status).toBe(200);
});

test('el_orden_de_los_errores_es_primero_sesion_luego_terminos', async () => {
  expect((await request(app).get('/api/clients')).status).toBe(401);
});
