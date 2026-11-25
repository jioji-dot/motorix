// Forma exacta de GET y PUT /api/settings (contracts/api.md, FR-001).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let admin;

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
});
afterAll(cerrarConexiones);

const forma = (data) => {
  expect(Object.keys(data).sort()).toEqual(['defaults', 'maintenance', 'workshop']);
  expect(Object.keys(data.workshop).sort()).toEqual(['address', 'name', 'phone']);
  expect(Object.keys(data.maintenance).sort()).toEqual(['warnDays', 'warnKm']);
  expect(Object.keys(data.defaults).sort()).toEqual(['warnDays', 'warnKm']);
};

test('get_y_put_devuelven_la_misma_forma', async () => {
  const get = await request(app).get('/api/settings').set('Authorization', `Bearer ${admin.token}`);
  forma(get.body.data);
  const put = await request(app).put('/api/settings').set('Authorization', `Bearer ${admin.token}`).send({ maintenance: { warnKm: 800 } });
  expect(put.status).toBe(200);
  forma(put.body.data);
  expect(put.body.data.maintenance.warnKm).toBe(800);
});

test('el_error_de_validacion_usa_el_formato_de_error', async () => {
  const r = await request(app).put('/api/settings').set('Authorization', `Bearer ${admin.token}`).send({ maintenance: { warnDays: 0 } });
  expect(r.status).toBe(400);
  expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: expect.any(String), details: expect.any(Array) });
  expect(r.body.error.details[0]).toMatchObject({ field: 'maintenance.warnDays' });
});
