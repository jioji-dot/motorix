// Términos y condiciones: versión vigente, aceptación, publicación y aceptaciones (Sprint 7, FR-018, FR-020, FR-022).
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
const publicar = (u, cuerpo) => request(app).post('/api/terms').set(auth(u)).send(cuerpo);
const vigente = (u) => request(app).get('/api/terms/current').set(auth(u));

test('sin_version_publicada_current_devuelve_null_y_accept_responde_404', async () => {
  expect((await vigente(usuarios.ADMIN)).body.data).toBeNull();
  expect((await request(app).post('/api/terms/accept').set(auth(usuarios.ADMIN))).status).toBe(404);
});

test('solo_el_administrador_publica_y_los_textos_son_obligatorios', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) {
    expect((await publicar(u, { termsText: 'T', privacyText: 'P' })).status).toBe(403);
    expect((await request(app).get('/api/terms/acceptances').set(auth(u))).status).toBe(403);
  }
  expect((await publicar(usuarios.ADMIN, { termsText: '', privacyText: 'P' })).status).toBe(400);
  expect((await publicar(usuarios.ADMIN, { termsText: 'T' })).status).toBe(400);
});

test('publicar_crea_la_version_1_acepta_automaticamente_al_administrador_y_registra_la_bitacora', async () => {
  const r = await publicar(usuarios.ADMIN, { termsText: 'Términos uno', privacyText: 'Privacidad uno' });
  expect(r.status).toBe(201);
  expect(r.body.data).toMatchObject({ version: 1, termsText: 'Términos uno', privacyText: 'Privacidad uno', accepted: true });
  const [[bit]] = await pool.query("SELECT entityId FROM audit_log WHERE action = 'TERMS_PUBLISHED'");
  expect(bit.entityId).toBe(1);
});

test('current_indica_si_el_usuario_acepto_y_accept_guarda_usuario_version_y_fecha_sin_duplicar', async () => {
  expect((await vigente(usuarios.RECEPTIONIST)).body.data).toMatchObject({ version: 1, accepted: false });
  const a = await request(app).post('/api/terms/accept').set(auth(usuarios.RECEPTIONIST));
  expect(a.status).toBe(200);
  expect(a.body.data).toMatchObject({ version: 1, acceptedAt: expect.any(String) });
  await request(app).post('/api/terms/accept').set(auth(usuarios.RECEPTIONIST));
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM terms_acceptances WHERE userId = ?', [usuarios.RECEPTIONIST.id]);
  expect(n).toBe(1);
  expect((await vigente(usuarios.RECEPTIONIST)).body.data.accepted).toBe(true);
});

test('las_aceptaciones_separan_aceptados_y_pendientes', async () => {
  const r = await request(app).get('/api/terms/acceptances').set(auth(usuarios.ADMIN));
  expect(r.status).toBe(200);
  expect(r.body.data.version).toBe(1);
  expect(r.body.data.accepted.map((u) => u.userId).sort()).toEqual([usuarios.ADMIN.id, usuarios.RECEPTIONIST.id].sort());
  expect(r.body.data.pending.map((u) => u.userId)).toEqual([usuarios.MECHANIC.id]);
});

test('dos_publicaciones_simultaneas_reciben_numeros_distintos_y_la_vigente_es_la_mayor', async () => {
  const [a, b] = await Promise.all([
    publicar(usuarios.ADMIN, { termsText: 'A', privacyText: 'A' }),
    publicar(usuarios.ADMIN, { termsText: 'B', privacyText: 'B' }),
  ]);
  expect([a.body.data.version, b.body.data.version].sort()).toEqual([2, 3]);
  expect((await vigente(usuarios.ADMIN)).body.data.version).toBe(3);
  expect((await vigente(usuarios.RECEPTIONIST)).body.data.accepted).toBe(false);
});
