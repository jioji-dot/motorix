// Forma exacta de GET y POST /api/client-notices (contracts/api.md, FR-015, FR-017).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let orden;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const c = await crearClienteConVehiculo();
  orden = await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: 'TERMINADO' });
});
afterAll(cerrarConexiones);

test('get_devuelve_la_forma_del_contrato', async () => {
  const r = await request(app).get('/api/client-notices').set('Authorization', `Bearer ${usuarios.RECEPTIONIST.token}`);
  expect(r.status).toBe(200);
  expect(Object.keys(r.body.meta).sort()).toEqual(['page', 'pageSize', 'total']);
  const [hecho] = r.body.data;
  expect(Object.keys(hecho).sort()).toEqual(['client', 'detail', 'factDate', 'factId', 'kind', 'reason', 'target', 'vehicle']);
  expect(Object.keys(hecho.client).sort()).toEqual(['id', 'name', 'phone']);
  expect(Object.keys(hecho.vehicle).sort()).toEqual(['id', 'licensePlate', 'title']);
  expect(Object.keys(hecho.target).sort()).toEqual(['id', 'kind']);
});

test('post_devuelve_la_forma_del_contrato', async () => {
  const r = await request(app).post('/api/client-notices').set('Authorization', `Bearer ${usuarios.RECEPTIONIST.token}`)
    .send({ kind: 'ORDEN_LISTA', factId: orden, note: 'Avisado por teléfono' });
  expect(r.status).toBe(201);
  expect(Object.keys(r.body.data).sort()).toEqual(['client', 'factId', 'id', 'kind', 'note', 'noticedAt', 'noticedBy']);
  expect(Object.keys(r.body.data.client).sort()).toEqual(['id', 'name']);
  expect(Object.keys(r.body.data.noticedBy).sort()).toEqual(['id', 'name']);
});

test('el_error_de_hecho_no_aplicable_usa_el_formato_de_error', async () => {
  const c = await crearClienteConVehiculo();
  const entregada = await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: 'ENTREGADO' });
  const r = await request(app).post('/api/client-notices').set('Authorization', `Bearer ${usuarios.ADMIN.token}`).send({ kind: 'ORDEN_LISTA', factId: entregada });
  expect(r.status).toBe(409);
  expect(r.body.error).toMatchObject({ code: 'NOTICE_NOT_APPLICABLE', message: expect.any(String) });
});
