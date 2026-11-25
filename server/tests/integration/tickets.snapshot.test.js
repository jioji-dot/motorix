// Instantánea del ticket: datos del taller al generarse (Sprint 7, FR-002).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrdenCobrable, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const nuevaOrden = async () => {
  const c = await crearClienteConVehiculo();
  return crearOrdenCobrable({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
};
const generar = (id) => request(app).post(`/api/orders/${id}/ticket`).set(auth(usuarios.RECEPTIONIST));
const leer = (id) => request(app).get(`/api/orders/${id}/ticket`).set(auth(usuarios.RECEPTIONIST));
const configurar = (cuerpo) => request(app).put('/api/settings').set(auth(usuarios.ADMIN)).send(cuerpo);

test('el_ticket_guarda_la_instantanea_del_taller_al_generarse', async () => {
  await configurar({ workshop: { name: 'Taller Uno', address: 'Calle 1', phone: '111' } });
  const id = await nuevaOrden();
  const r = await generar(id);
  expect(r.status).toBe(201);
  expect(r.body.data.workshop).toEqual({ name: 'Taller Uno', address: 'Calle 1', phone: '111' });
  const [[fila]] = await pool.query('SELECT shopName, shopAddress, shopPhone FROM tickets WHERE orderId = ?', [id]);
  expect(fila).toEqual({ shopName: 'Taller Uno', shopAddress: 'Calle 1', shopPhone: '111' });
});

test('cambiar_la_configuracion_no_altera_el_ticket_generado_y_si_el_siguiente', async () => {
  const primero = await nuevaOrden();
  await generar(primero);
  await configurar({ workshop: { name: 'Taller Dos', phone: '222' } });
  expect((await leer(primero)).body.data.workshop.name).toBe('Taller Uno');
  const segundo = await nuevaOrden();
  expect((await generar(segundo)).body.data.workshop).toMatchObject({ name: 'Taller Dos', phone: '222' });
});

test('repetir_la_generacion_no_reescribe_la_instantanea', async () => {
  const id = await nuevaOrden();
  await generar(id);
  await configurar({ workshop: { name: 'Taller Tres' } });
  const otra = await generar(id);
  expect(otra.status).toBe(200);
  expect(otra.body.data.workshop.name).toBe('Taller Dos');
});

test('un_ticket_anterior_al_sprint_sin_instantanea_se_arma_con_los_datos_vigentes', async () => {
  const id = await nuevaOrden();
  await generar(id);
  await pool.execute('UPDATE tickets SET shopName = NULL, shopAddress = NULL, shopPhone = NULL WHERE orderId = ?', [id]);
  await configurar({ workshop: { name: 'Taller Vigente' } });
  expect((await leer(id)).body.data.workshop.name).toBe('Taller Vigente');
});

test('sin_configuracion_el_ticket_usa_los_datos_de_env', async () => {
  await pool.query('DELETE FROM settings');
  const id = await nuevaOrden();
  expect((await generar(id)).body.data.workshop).toEqual(env.workshop);
});
