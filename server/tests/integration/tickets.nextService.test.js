// Próximo servicio en el ticket a partir de los tipos de servicio con intervalo (Sprint 7, FR-008, FR-002).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import * as serviceTypeModel from '../../models/serviceTypeModel.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearUsuariosDePrueba, fechaDia, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const generar = (id) => request(app).post(`/api/orders/${id}/ticket`).set(auth(usuarios.RECEPTIONIST));
const orden = async (tipos = []) => {
  const c = await crearClienteConVehiculo({ km: 40000 });
  const id = await crearOrdenCobrable({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  for (const tipo of tipos) {
    await pool.execute('INSERT INTO order_services (orderId, description, amount, serviceTypeId) VALUES (?, ?, 100, ?)', [id, `Servicio ${tipo}`, tipo]);
  }
  return id;
};

test('con_un_tipo_con_intervalo_el_ticket_trae_nombre_fecha_y_kilometraje', async () => {
  const aceite = await serviceTypeModel.create({ name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 });
  const id = await orden([aceite]);
  const r = await generar(id);
  expect(r.body.data.nextService).toEqual({ name: 'Cambio de aceite', date: fechaDia(180), mileage: 45000 });
});

test('sin_tipos_con_intervalo_next_service_es_null', async () => {
  const id = await orden();
  expect((await generar(id)).body.data.nextService).toBeNull();
});

test('con_varios_tipos_toma_la_fecha_mas_cercana_y_el_kilometraje_menor', async () => {
  const frenos = await serviceTypeModel.create({ name: 'Frenos', intervalDays: 60, intervalKm: 20000 });
  const llantas = await serviceTypeModel.create({ name: 'Llantas', intervalDays: 400, intervalKm: 8000 });
  const id = await orden([frenos, llantas]);
  expect((await generar(id)).body.data.nextService).toEqual({ name: 'Frenos', date: fechaDia(60), mileage: 48000 });
});

test('con_solo_dias_o_solo_kilometros_el_otro_dato_es_nulo', async () => {
  const soloDias = await serviceTypeModel.create({ name: 'Revisión anual', intervalDays: 365, intervalKm: null });
  const soloKm = await serviceTypeModel.create({ name: 'Afinación', intervalDays: null, intervalKm: 10000 });
  expect((await generar(await orden([soloDias]))).body.data.nextService).toEqual({ name: 'Revisión anual', date: fechaDia(365), mileage: null });
  expect((await generar(await orden([soloKm]))).body.data.nextService).toEqual({ name: 'Afinación', date: null, mileage: 50000 });
});

test('cambiar_el_catalogo_despues_no_cambia_el_ticket_generado', async () => {
  const tipo = await serviceTypeModel.create({ name: 'Batería', intervalDays: 100, intervalKm: 1000 });
  const id = await orden([tipo]);
  await generar(id);
  await serviceTypeModel.update(tipo, { intervalDays: 10, intervalKm: 10 });
  const r = await request(app).get(`/api/orders/${id}/ticket`).set(auth(usuarios.RECEPTIONIST));
  expect(r.body.data.nextService).toEqual({ name: 'Batería', date: fechaDia(100), mileage: 41000 });
});

test('la_pagina_imprimible_muestra_el_proximo_servicio_solo_cuando_existe', async () => {
  const tipo = await serviceTypeModel.create({ name: 'Alineación', intervalDays: 90, intervalKm: null });
  const con = await orden([tipo]);
  const sin = await orden();
  for (const [id, esperado] of [[con, true], [sin, false]]) {
    await generar(id);
    const enlace = await request(app).post(`/api/orders/${id}/ticket/print-link`).set(auth(usuarios.RECEPTIONIST));
    const pagina = await request(app).get(new URL(enlace.body.data.url).pathname);
    expect(pagina.status).toBe(200);
    expect(pagina.text.includes('Próximo servicio')).toBe(esperado);
  }
});
