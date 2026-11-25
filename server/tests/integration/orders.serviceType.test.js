// Las líneas de servicio de una orden se enlazan con un tipo de servicio (Sprint 7, FR-006).
import request from 'supertest';
import { app } from '../../app.js';
import * as serviceTypeModel from '../../models/serviceTypeModel.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let activo;
let inactivo;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  activo = await serviceTypeModel.create({ name: 'Activo', intervalDays: 100, intervalKm: null });
  inactivo = await serviceTypeModel.create({ name: 'Inactivo', intervalDays: 100, intervalKm: null });
  await serviceTypeModel.update(inactivo, { active: false });
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const nuevaOrden = async (mecanico = usuarios.MECHANIC) => {
  const c = await crearClienteConVehiculo();
  return crearOrden({ ...c, mechanicId: mecanico.id, createdBy: usuarios.ADMIN.id, status: 'EN_REPARACION' });
};
const agregar = (u, id, cuerpo) => request(app).post(`/api/orders/${id}/services`).set(auth(u)).send(cuerpo);
const servicios = async (u, id) => (await request(app).get(`/api/orders/${id}`).set(auth(u))).body.data.services;

test('una_linea_acepta_un_tipo_activo_y_la_orden_devuelve_su_id_y_nombre', async () => {
  const id = await nuevaOrden();
  const r = await agregar(usuarios.ADMIN, id, { description: 'Aceite y filtro', amount: 500, serviceTypeId: activo });
  expect(r.status).toBe(201);
  expect(await servicios(usuarios.ADMIN, id)).toEqual([expect.objectContaining({ description: 'Aceite y filtro', serviceTypeId: activo, serviceTypeName: 'Activo' })]);
});

test('las_lineas_sin_tipo_siguen_funcionando', async () => {
  const id = await nuevaOrden();
  await agregar(usuarios.ADMIN, id, { description: 'Libre', amount: 100 });
  expect(await servicios(usuarios.ADMIN, id)).toEqual([expect.objectContaining({ serviceTypeId: null, serviceTypeName: null })]);
});

test('un_tipo_inexistente_o_desactivado_responde_400', async () => {
  const id = await nuevaOrden();
  for (const serviceTypeId of [99999, inactivo]) {
    const r = await agregar(usuarios.ADMIN, id, { description: 'X', amount: 1, serviceTypeId });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  }
});

test('editar_la_linea_permite_cambiar_o_quitar_el_tipo', async () => {
  const id = await nuevaOrden();
  await agregar(usuarios.ADMIN, id, { description: 'L', amount: 10, serviceTypeId: activo });
  const [{ id: lineId }] = await servicios(usuarios.ADMIN, id);
  const quitar = await request(app).patch(`/api/orders/${id}/services/${lineId}`).set(auth(usuarios.ADMIN)).send({ serviceTypeId: null });
  expect(quitar.status).toBe(200);
  expect((await servicios(usuarios.ADMIN, id))[0].serviceTypeId).toBeNull();
});

test('desactivar_un_tipo_no_cambia_las_lineas_que_ya_lo_usan', async () => {
  const id = await nuevaOrden();
  const temporal = await serviceTypeModel.create({ name: 'Temporal', intervalKm: 100 });
  await agregar(usuarios.ADMIN, id, { description: 'T', amount: 10, serviceTypeId: temporal });
  await serviceTypeModel.update(temporal, { active: false });
  expect(await servicios(usuarios.ADMIN, id)).toEqual([expect.objectContaining({ serviceTypeId: temporal, serviceTypeName: 'Temporal' })]);
});

test('el_mecanico_lo_hace_en_sus_ordenes_y_no_en_las_ajenas', async () => {
  const suya = await nuevaOrden();
  expect((await agregar(usuarios.MECHANIC, suya, { description: 'S', amount: 1, serviceTypeId: activo })).status).toBe(201);
  const ajena = await nuevaOrden(usuarios.ADMIN);
  expect((await agregar(usuarios.MECHANIC, ajena, { description: 'S', amount: 1, serviceTypeId: activo })).status).toBeGreaterThanOrEqual(403);
});
