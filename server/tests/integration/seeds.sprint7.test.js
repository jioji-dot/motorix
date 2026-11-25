// Los datos de ejemplo del Sprint 7: configuración, tipos de servicio, términos y reportes con información (FR-023, FR-032, SC-007).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { aceptarTerminos, aplicarSeeds, cerrarConexiones, emitirToken, fechaDia, limpiarBase } from '../helpers.js';

const TABLAS = [
  'users', 'clients', 'vehicles', 'appointments', 'service_orders', 'order_status_history', 'order_services', 'order_labor', 'order_parts',
  'parts', 'inventory_movements', 'maintenance', 'payments', 'tickets', 'notification_reads', 'client_notices', 'settings', 'service_types',
  'terms_versions', 'terms_acceptances', 'audit_log',
];
const conteos = async () => {
  const r = {};
  for (const t of TABLAS) r[t] = (await pool.query(`SELECT COUNT(*) AS n FROM ${t}`))[0][0].n;
  return r;
};

let admin;

beforeAll(async () => {
  await limpiarBase();
  aplicarSeeds();
  const [[{ id }]] = await pool.query("SELECT id FROM users WHERE username = 'admin'");
  admin = { id, token: emitirToken(id) };
}, 120000);
afterAll(cerrarConexiones);

test('cargar_los_seeds_dos_veces_no_cambia_el_conteo_de_ninguna_tabla', async () => {
  const primera = await conteos();
  expect(primera.settings).toBe(5);
  expect(primera.service_types).toBeGreaterThanOrEqual(4);
  expect(primera.terms_versions).toBe(1);
  expect(primera.terms_acceptances).toBe(0);
  aplicarSeeds();
  expect(await conteos()).toEqual(primera);
}, 120000);

test('los_tipos_de_servicio_traen_intervalos_y_hay_lineas_enlazadas', async () => {
  const [tipos] = await pool.query('SELECT name, intervalDays, intervalKm FROM service_types');
  expect(tipos.every((t) => t.intervalDays || t.intervalKm)).toBe(true);
  expect(tipos.find((t) => t.name === 'Cambio de aceite')).toMatchObject({ intervalDays: 180, intervalKm: 5000 });
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM order_services WHERE serviceTypeId IS NOT NULL');
  expect(n).toBeGreaterThan(0);
});

test('la_version_1_de_los_terminos_cubre_los_cuatro_temas_y_exige_aceptacion', async () => {
  const [[v]] = await pool.query('SELECT termsText, privacyText FROM terms_versions WHERE version = 1');
  const texto = `${v.termsText} ${v.privacyText}`.toLowerCase();
  for (const tema of ['uso permitido', 'confidencialidad', 'cuentas personales', 'aviso de privacidad']) expect(texto).toContain(tema);
  const sinAceptar = await request(app).get('/api/clients').set({ Authorization: `Bearer ${admin.token}` });
  expect(sinAceptar.status).toBe(403);
  expect(sinAceptar.body.error.code).toBe('TERMS_NOT_ACCEPTED');
});

test('la_configuracion_inicial_se_lee_y_cada_reporte_muestra_informacion', async () => {
  await aceptarTerminos(admin);
  const h = { Authorization: `Bearer ${admin.token}` };
  const ajustes = await request(app).get('/api/settings').set(h);
  expect(ajustes.body.data).toMatchObject({ workshop: { name: 'Motorix Taller Mecánico' }, maintenance: { warnDays: 15, warnKm: 500 } });

  const rango = `from=${fechaDia(-90)}&to=${fechaDia(0)}`;
  const ingresos = (await request(app).get(`/api/reports/income?${rango}`).set(h)).body.data;
  expect(Number(ingresos.total)).toBeGreaterThan(0);
  const servicios = (await request(app).get(`/api/reports/services?${rango}`).set(h)).body.data;
  expect(servicios.items.length).toBeGreaterThan(0);
  const productividad = (await request(app).get(`/api/reports/productivity?${rango}`).set(h)).body.data;
  expect(productividad.totalOrders).toBeGreaterThan(0);
  const refacciones = (await request(app).get(`/api/reports/parts?${rango}`).set(h)).body.data;
  expect(refacciones.items.length).toBeGreaterThan(0);
  const rotacion = (await request(app).get(`/api/reports/rotation?${rango}`).set(h)).body.data;
  expect(rotacion.items.length).toBeGreaterThan(0);
});
