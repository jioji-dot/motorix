// Encabezados de seguridad de la API (Sprint 7, FR-029).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const verificar = (r) => {
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  expect(r.headers['x-frame-options']).toBe('DENY');
  expect(r.headers['referrer-policy']).toBe('no-referrer');
  expect(r.headers['cache-control']).toBe('no-store');
  expect(r.headers['x-powered-by']).toBeUndefined();
};

test('las_respuestas_correctas_traen_los_encabezados', async () => {
  verificar(await request(app).get('/api/clients').set({ Authorization: `Bearer ${usuarios.ADMIN.token}` }));
});

test('las_respuestas_de_error_tambien', async () => {
  verificar(await request(app).get('/api/clients'));
  verificar(await request(app).get('/api/no-existe'));
  verificar(await request(app).post('/api/auth/login').send({}));
});

test('la_pagina_imprimible_del_ticket_conserva_sus_propios_encabezados_de_seguridad', async () => {
  const r = await request(app).get('/api/tickets/print/token-invalido');
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  expect(r.headers['x-powered-by']).toBeUndefined();
});
