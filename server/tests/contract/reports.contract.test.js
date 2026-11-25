// Forma exacta de los cinco reportes y del enlace de exportación (contracts/api.md, FR-009 a FR-016).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearUsuariosDePrueba, fechaDia, limpiarBase } from '../helpers.js';

let admin;

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
});
afterAll(cerrarConexiones);

const get = (ruta) => request(app).get(`${ruta}?from=${fechaDia(-5)}&to=${fechaDia(0)}`).set({ Authorization: `Bearer ${admin.token}` });
const claves = (o) => Object.keys(o).sort();

test('ingresos', async () => {
  expect(claves((await get('/api/reports/income')).body.data)).toEqual(['byMethod', 'byPeriod', 'total']);
});

test('servicios_productividad_refacciones_y_rotacion_sin_datos', async () => {
  expect(claves((await get('/api/reports/services')).body.data)).toEqual(['items']);
  expect(claves((await get('/api/reports/productivity')).body.data)).toEqual(['items', 'totalLabor', 'totalOrders']);
  expect(claves((await get('/api/reports/parts')).body.data)).toEqual(['items', 'totalCost', 'totalMargin', 'totalSale']);
  expect(claves((await get('/api/reports/rotation')).body.data)).toEqual(['items']);
});

test('el_enlace_de_exportacion_tiene_url_y_vigencia', async () => {
  const r = await get('/api/reports/income/export-link');
  expect(claves(r.body.data)).toEqual(['expiresInSeconds', 'url']);
});

test('el_error_de_rango_usa_el_formato_de_error', async () => {
  const r = await request(app).get('/api/reports/income?from=2024-01-01&to=2026-01-01').set({ Authorization: `Bearer ${admin.token}` });
  expect(r.status).toBe(400);
  expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ field: 'to', message: expect.any(String) }] });
});
