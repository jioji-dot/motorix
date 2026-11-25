// Propuesta del próximo mantenimiento de una orden a partir de los intervalos de sus tipos (Sprint 7, FR-007).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import * as serviceTypeModel from '../../models/serviceTypeModel.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, fechaDia, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const proponer = (u, id) => request(app).get(`/api/orders/${id}/maintenance-proposal`).set(auth(u));
const orden = async (tipos, extra = {}, mecanico = usuarios.MECHANIC) => {
  const c = await crearClienteConVehiculo({ km: 50000 });
  const id = await crearOrden({ ...c, mechanicId: mecanico.id, createdBy: usuarios.ADMIN.id, status: 'EN_REPARACION', entryMileage: 40000 });
  if (extra.serviceMileage) await pool.execute('UPDATE service_orders SET serviceMileage = ? WHERE id = ?', [extra.serviceMileage, id]);
  for (const t of tipos) await pool.execute('INSERT INTO order_services (orderId, description, amount, serviceTypeId) VALUES (?, ?, 10, ?)', [id, 'Servicio', t]);
  return id;
};

test('propone_fecha_y_kilometraje_por_cada_tipo_con_intervalo', async () => {
  const aceite = await serviceTypeModel.create({ name: 'Aceite', intervalDays: 180, intervalKm: 5000 });
  const id = await orden([aceite]);
  const r = await proponer(usuarios.ADMIN, id);
  expect(r.status).toBe(200);
  expect(r.body.data).toEqual([{ serviceTypeId: aceite, serviceType: 'Aceite', nextDate: fechaDia(180), nextMileage: 45000 }]);
});

test('usa_el_kilometraje_del_servicio_si_existe', async () => {
  const aceite = await serviceTypeModel.create({ name: 'Aceite 2', intervalDays: 10, intervalKm: 1000 });
  const id = await orden([aceite], { serviceMileage: 41000 });
  expect((await proponer(usuarios.ADMIN, id)).body.data[0].nextMileage).toBe(42000);
});

test('con_solo_un_intervalo_el_otro_dato_es_nulo', async () => {
  const soloDias = await serviceTypeModel.create({ name: 'Solo días', intervalDays: 30 });
  const soloKm = await serviceTypeModel.create({ name: 'Solo km', intervalKm: 500 });
  const data = (await proponer(usuarios.ADMIN, await orden([soloDias, soloKm]))).body.data;
  expect(data).toEqual([
    { serviceTypeId: soloDias, serviceType: 'Solo días', nextDate: fechaDia(30), nextMileage: null },
    { serviceTypeId: soloKm, serviceType: 'Solo km', nextDate: null, nextMileage: 40500 },
  ]);
});

test('sin_tipos_devuelve_una_lista_vacia_y_un_tipo_repetido_se_propone_una_vez', async () => {
  expect((await proponer(usuarios.ADMIN, await orden([]))).body.data).toEqual([]);
  const t = await serviceTypeModel.create({ name: 'Repetido', intervalDays: 7 });
  expect((await proponer(usuarios.ADMIN, await orden([t, t]))).body.data).toHaveLength(1);
});

test('orden_inexistente_404_y_el_mecanico_no_accede_a_una_ajena', async () => {
  expect((await proponer(usuarios.ADMIN, 99999)).status).toBe(404);
  const ajena = await orden([], {}, usuarios.ADMIN);
  expect((await proponer(usuarios.MECHANIC, ajena)).status).toBeGreaterThanOrEqual(403);
  expect((await proponer(usuarios.RECEPTIONIST, ajena)).status).toBe(200);
});
