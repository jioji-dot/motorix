// GET /api/notifications para el administrador con una orden detenida: grupos, conteos y datos sin teléfonos (FR-001 a FR-003).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearOrdenDetenida, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const consultar = (usuario) => request(app).get('/api/notifications').set('Authorization', `Bearer ${usuario.token}`);

test('sin_sesion_responde_401', async () => {
  expect((await request(app).get('/api/notifications')).status).toBe(401);
});

test('sin_avisos_el_administrador_recibe_una_respuesta_vacia', async () => {
  const r = await consultar(usuarios.ADMIN);
  expect(r.status).toBe(200);
  expect(r.body.data).toMatchObject({ unread: 0, total: 0, groups: [] });
  expect(r.body.meta).toEqual({ limitPerType: 10 });
});

test('una_orden_detenida_aparece_en_su_grupo_con_los_conteos_y_sin_telefonos', async () => {
  const { id } = await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, dias: 5 });
  const r = await consultar(usuarios.ADMIN);
  expect(r.status).toBe(200);
  expect(r.body.data.unread).toBe(1);
  expect(r.body.data.total).toBe(1);
  expect(r.body.data.groups).toHaveLength(1);
  const [grupo] = r.body.data.groups;
  expect(grupo).toMatchObject({ type: 'ORDER_STALLED', total: 1, unread: 1 });
  expect(grupo.items[0]).toMatchObject({
    key: `ORDEN:${id}`, type: 'ORDER_STALLED', read: false, target: { kind: 'order', id },
    data: { folio: `OS-${String(id).padStart(6, '0')}`, status: 'EN_REPARACION', daysStalled: 5 },
  });
  expect(JSON.stringify(r.body)).not.toMatch(/phone|"55\d{8}"/);
});

test('los_avisos_no_se_guardan_solo_se_guarda_la_lectura', async () => {
  const [tablas] = await pool.query("SHOW TABLES LIKE 'notifications'");
  expect(tablas).toHaveLength(0);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM notification_reads');
  expect(n).toBe(0);
});
