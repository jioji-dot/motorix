// Forma exacta de los tipos de servicio y de la propuesta (contracts/api.md, FR-005, FR-007).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let admin;

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
});
afterAll(cerrarConexiones);

test('el_tipo_de_servicio_tiene_la_forma_del_contrato', async () => {
  const h = { Authorization: `Bearer ${admin.token}` };
  const alta = await request(app).post('/api/service-types').set(h).send({ name: 'Frenos', intervalDays: 90 });
  expect(Object.keys(alta.body.data).sort()).toEqual(['active', 'id', 'intervalDays', 'intervalKm', 'name']);
  const lista = await request(app).get('/api/service-types').set(h);
  expect(lista.body.data[0]).toEqual({ id: expect.any(Number), name: 'Frenos', intervalDays: 90, intervalKm: null, active: true });
  const duplicado = await request(app).post('/api/service-types').set(h).send({ name: 'frenos', intervalDays: 90 });
  expect(duplicado.body.error).toMatchObject({ code: 'SERVICE_TYPE_DUPLICATE', message: expect.any(String) });
});
