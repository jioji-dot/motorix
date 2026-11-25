// Reporte de ingresos por periodo (Sprint 7, FR-009, FR-014, FR-015, FR-017, SC-002).
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearUsuariosDePrueba, fechaDia, limpiarBase, pagarEn,
} from '../helpers.js';

let usuarios;
let orden;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const c = await crearClienteConVehiculo();
  orden = await crearOrdenCobrable({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, total: 5000 });
  const base = { orderId: orden, createdBy: usuarios.ADMIN.id };
  await pagarEn({ ...base, fecha: fechaDia(-2), amount: '100.10', method: 'EFECTIVO' });
  await pagarEn({ ...base, fecha: fechaDia(-1), amount: '250.55', method: 'TARJETA' });
  await pagarEn({ ...base, fecha: fechaDia(0), amount: '49.35', method: 'EFECTIVO' });
  await pagarEn({ ...base, fecha: fechaDia(-1), amount: '999.00', status: 'PENDIENTE', method: 'MERCADO_PAGO' });
  await pagarEn({ ...base, fecha: fechaDia(-1), amount: '888.00', status: 'RECHAZADO', method: 'MERCADO_PAGO' });
  await pagarEn({ ...base, fecha: fechaDia(-40), amount: '777.00' }); // fuera del rango
});
afterAll(cerrarConexiones);

const consultar = (u, consulta) => request(app).get(`/api/reports/income${consulta}`).set({ Authorization: `Bearer ${u.token}` });
const rango = `?from=${fechaDia(-2)}&to=${fechaDia(0)}`;
const centavos = (texto) => Math.round(Number(texto) * 100);

test('el_total_y_los_desgloses_coinciden_con_los_pagos_pagados_del_rango_en_centavos', async () => {
  const r = await consultar(usuarios.ADMIN, rango);
  expect(r.status).toBe(200);
  expect(r.body.data.total).toBe('400.00');
  expect(r.body.data.byMethod).toEqual(expect.arrayContaining([{ method: 'EFECTIVO', total: '149.45' }, { method: 'TARJETA', total: '250.55' }]));
  expect(r.body.data.byMethod).toHaveLength(2);
  expect(r.body.data.byPeriod).toEqual([
    { period: fechaDia(-2), total: '100.10' },
    { period: fechaDia(-1), total: '250.55' },
    { period: fechaDia(0), total: '49.35' },
  ]);
});

test('agrupar_por_dia_o_por_mes_suma_lo_mismo', async () => {
  const dia = await consultar(usuarios.ADMIN, `${rango}&groupBy=day`);
  const mes = await consultar(usuarios.ADMIN, `${rango}&groupBy=month`);
  const suma = (r) => r.body.data.byPeriod.reduce((t, p) => t + centavos(p.total), 0);
  expect(suma(dia)).toBe(40000);
  expect(suma(mes)).toBe(40000);
  expect(mes.body.data.byPeriod.every((p) => /^\d{4}-\d{2}$/.test(p.period))).toBe(true);
  expect(centavos(mes.body.data.total)).toBe(40000);
});

test('los_limites_del_rango_son_inclusivos_y_un_solo_dia_es_valido', async () => {
  const unDia = await consultar(usuarios.ADMIN, `?from=${fechaDia(-1)}&to=${fechaDia(-1)}`);
  expect(unDia.body.data.total).toBe('250.55');
});

test('sin_pagos_devuelve_ceros_y_listas_vacias', async () => {
  const r = await consultar(usuarios.ADMIN, '?from=2000-01-01&to=2000-01-31');
  expect(r.status).toBe(200);
  expect(r.body.data).toEqual({ total: '0.00', byMethod: [], byPeriod: [] });
});

test('rangos_invalidos_responden_400', async () => {
  for (const consulta of [
    '', `?from=${fechaDia(0)}`, `?from=${fechaDia(0)}&to=${fechaDia(-1)}`, '?from=2024-01-01&to=2025-06-01', '?from=ayer&to=hoy', `${rango}&groupBy=semana`,
  ]) {
    const r = await consultar(usuarios.ADMIN, consulta);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  }
});

test('un_rango_de_exactamente_366_dias_es_valido', async () => {
  expect((await consultar(usuarios.ADMIN, `?from=${fechaDia(-365)}&to=${fechaDia(0)}`)).status).toBe(200);
  expect((await consultar(usuarios.ADMIN, `?from=${fechaDia(-366)}&to=${fechaDia(0)}`)).status).toBe(400);
});

test('recepcion_y_mecanico_reciben_403_y_sin_sesion_401', async () => {
  for (const u of [usuarios.RECEPTIONIST, usuarios.MECHANIC]) expect((await consultar(u, rango)).status).toBe(403);
  expect((await request(app).get(`/api/reports/income${rango}`)).status).toBe(401);
});
