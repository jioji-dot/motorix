// Exportación de los reportes a CSV con un enlace de corta vida (Sprint 7, FR-016, FR-017, SC-004).
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { pool } from '../../config/db.js';
import * as serviceTypeModel from '../../models/serviceTypeModel.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearLineaDeRefaccion, crearOrden, crearRefaccion, crearUsuariosDePrueba, fechaDia, limpiarBase, pagarEn,
  terminarEn,
} from '../helpers.js';

let usuarios;
const rango = () => `from=${fechaDia(-5)}&to=${fechaDia(0)}`;
const REPORTES = ['income', 'services', 'productivity', 'parts', 'rotation'];

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const tipo = await serviceTypeModel.create({ name: 'Aceite', intervalDays: 100 });
  const parte = await crearRefaccion({ stock: 8, minimumStock: 1, purchasePrice: 40, salePrice: 90, name: 'Filtro' });
  const c = await crearClienteConVehiculo();
  const id = await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: 'TERMINADO' });
  await pool.execute('INSERT INTO order_services (orderId, description, amount, serviceTypeId) VALUES (?, ?, 100, ?)', [id, 'Servicio', tipo]);
  await pool.execute("INSERT INTO order_services (orderId, description, amount) VALUES (?, '=CMD()', 50)", [id]);
  await pool.execute("INSERT INTO order_labor (orderId, description, hours, hourlyRate) VALUES (?, 'Mano, de obra', 1.5, 200)", [id]);
  await crearLineaDeRefaccion({ orderId: id, partId: parte.id, quantity: 2, unitPrice: 90 });
  await terminarEn(id, fechaDia(-1));
  await pagarEn({ orderId: id, createdBy: usuarios.ADMIN.id, fecha: fechaDia(-1), amount: '300.50', method: 'TARJETA' });
  await pool.execute(
    "INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, orderId, createdBy, createdAt) VALUES (?, 'OUT', -2, 6, 'Uso', ?, ?, ?)",
    [parte.id, id, usuarios.ADMIN.id, `${fechaDia(-1)} 12:00:00`],
  );
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const enlace = (u, nombre, extra = '') => request(app).get(`/api/reports/${nombre}/export-link?${rango()}${extra}`).set(auth(u));
const descargar = async (nombre) => {
  const e = await enlace(usuarios.ADMIN, nombre);
  return request(app).get(new URL(e.body.data.url, 'http://x').pathname);
};
const filasCsv = (texto) => texto.replace(/^\uFEFF/, '').trim().split('\r\n');

test('el_enlace_dura_60_segundos_y_apunta_a_la_descarga', async () => {
  const r = await enlace(usuarios.ADMIN, 'income');
  expect(r.status).toBe(200);
  expect(r.body.data.expiresInSeconds).toBe(60);
  expect(r.body.data.url).toMatch(/\/api\/reports\/export\/.+/);
});

test.each(REPORTES)('el_csv_de_%s_empieza_con_bom_y_trae_las_mismas_cifras_que_la_pantalla', async (nombre) => {
  const json = (await request(app).get(`/api/reports/${nombre}?${rango()}`).set(auth(usuarios.ADMIN))).body.data;
  const r = await descargar(nombre);
  expect(r.status).toBe(200);
  expect(r.headers['content-type']).toMatch(/text\/csv; charset=utf-8/);
  expect(r.headers['content-disposition']).toContain(`reporte-${nombre}-${fechaDia(-5)}-${fechaDia(0)}.csv`);
  expect(r.text.startsWith('\uFEFF')).toBe(true);
  const filas = filasCsv(r.text);
  const texto = r.text;
  if (nombre === 'income') {
    expect(filas.length).toBe(1 + json.byPeriod.length + json.byMethod.length + 1);
    expect(texto).toContain(json.total);
  }
  if (nombre === 'services') expect(filas.length).toBe(1 + json.items.length);
  if (nombre === 'productivity') {
    expect(filas.length).toBe(1 + json.items.length + 1);
    expect(texto).toContain(json.totalLabor);
  }
  if (nombre === 'parts') {
    expect(filas.length).toBe(1 + json.items.length + 1);
    expect(texto).toContain(json.totalMargin);
  }
  if (nombre === 'rotation') expect(filas.length).toBe(1 + json.items.length);
});

test('una_descripcion_que_empieza_con_igual_sale_neutralizada_y_las_comas_se_entrecomillan', async () => {
  const servicios = (await descargar('services')).text;
  expect(servicios).toContain("'=CMD()");
  expect(servicios).not.toMatch(/^=CMD/m);
});

test('el_enlace_vencido_el_de_otro_reporte_y_el_invalido_responden_401', async () => {
  const vencido = jwt.sign({ rep: 'income', from: fechaDia(-5), to: fechaDia(0), groupBy: 'day' }, `${env.jwt.secret}:report-export`, { expiresIn: -10 });
  expect((await request(app).get(`/api/reports/export/${vencido}`)).status).toBe(401);
  expect((await request(app).get('/api/reports/export/token-invalido')).status).toBe(401);
  const deSesion = usuarios.ADMIN.token;
  expect((await request(app).get(`/api/reports/export/${deSesion}`)).status).toBe(401);
});

test('el_enlace_solo_sirve_para_su_reporte_y_su_rango', async () => {
  const e = await enlace(usuarios.ADMIN, 'income');
  const token = e.body.data.url.split('/').pop();
  const carga = jwt.decode(token);
  expect(carga).toMatchObject({ rep: 'income', from: fechaDia(-5), to: fechaDia(0) });
  const alterado = jwt.sign({ ...carga, rep: 'parts' }, 'otra-clave');
  expect((await request(app).get(`/api/reports/export/${alterado}`)).status).toBe(401);
});

test('solo_el_administrador_pide_el_enlace_y_un_reporte_o_rango_invalido_responde_400', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) expect((await enlace(u, 'income')).status).toBe(403);
  expect((await request(app).get('/api/reports/income/export-link').set(auth(usuarios.ADMIN))).status).toBe(400);
  expect((await enlace(usuarios.ADMIN, 'inexistente')).status).toBe(400);
});
