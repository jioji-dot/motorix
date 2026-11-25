// Forma exacta de GET y POST /api/notifications (contracts/api.md, FR-001).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearOrdenDetenida, crearRefaccion, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  await crearRefaccion({ stock: 0, minimumStock: 2 });
});
afterAll(cerrarConexiones);

const get = (u) => request(app).get('/api/notifications').set('Authorization', `Bearer ${u.token}`);

test('get_devuelve_la_forma_del_contrato', async () => {
  const r = await get(usuarios.ADMIN);
  expect(r.status).toBe(200);
  expect(Object.keys(r.body.data).sort()).toEqual(['groups', 'stockAlerts', 'total', 'unread'].sort());
  expect(r.body.meta).toEqual({ limitPerType: 10 });
  for (const grupo of r.body.data.groups) {
    expect(Object.keys(grupo).sort()).toEqual(['items', 'total', 'type', 'unread']);
    for (const item of grupo.items) {
      expect(Object.keys(item).sort()).toEqual(['data', 'detail', 'key', 'read', 'target', 'title', 'type']);
      expect(typeof item.key).toBe('string');
      expect(typeof item.read).toBe('boolean');
      expect(['order', 'appointment', 'part', 'maintenance']).toContain(item.target.kind);
    }
  }
});

test('get_sin_sesion_responde_401_con_el_formato_de_error', async () => {
  const r = await request(app).get('/api/notifications');
  expect(r.status).toBe(401);
  expect(r.body.error).toMatchObject({ code: 'UNAUTHENTICATED' });
});

test('post_read_sin_sesion_responde_401', async () => {
  expect((await request(app).post('/api/notifications/read').send({ key: 'ORDEN:1' })).status).toBe(401);
});

test('post_read_devuelve_key_y_read', async () => {
  const r = await request(app).post('/api/notifications/read').set('Authorization', `Bearer ${usuarios.ADMIN.token}`).send({ key: 'ORDEN:999999' });
  expect(r.status).toBe(200);
  expect(Object.keys(r.body.data).sort()).toEqual(['key', 'read']);
});
