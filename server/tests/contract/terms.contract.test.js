// Forma exacta de las rutas de términos y del error TERMS_NOT_ACCEPTED (contracts/api.md, FR-018, FR-021).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

test('las_rutas_de_terminos_tienen_la_forma_del_contrato', async () => {
  const publicada = await request(app).post('/api/terms').set(auth(usuarios.ADMIN)).send({ termsText: 'T', privacyText: 'P' });
  expect(publicada.status).toBe(201);
  expect(Object.keys(publicada.body.data).sort()).toEqual(['accepted', 'privacyText', 'publishedAt', 'termsText', 'version']);

  const actual = await request(app).get('/api/terms/current').set(auth(usuarios.RECEPTIONIST));
  expect(Object.keys(actual.body.data).sort()).toEqual(['accepted', 'privacyText', 'publishedAt', 'termsText', 'version']);

  const acepta = await request(app).post('/api/terms/accept').set(auth(usuarios.RECEPTIONIST));
  expect(Object.keys(acepta.body.data).sort()).toEqual(['acceptedAt', 'version']);

  const lista = await request(app).get('/api/terms/acceptances').set(auth(usuarios.ADMIN));
  expect(Object.keys(lista.body.data).sort()).toEqual(['accepted', 'pending', 'version']);
  expect(Object.keys(lista.body.data.accepted[0]).sort()).toEqual(['acceptedAt', 'name', 'userId']);
  expect(Object.keys(lista.body.data.pending[0]).sort()).toEqual(['name', 'userId']);
});

test('el_error_usa_el_formato_de_error', async () => {
  const r = await request(app).get('/api/clients').set(auth(usuarios.MECHANIC));
  expect(r.status).toBe(403);
  expect(r.body.error).toMatchObject({ code: 'TERMS_NOT_ACCEPTED', message: expect.any(String) });
});
