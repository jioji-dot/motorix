// El mecánico solo recibe los avisos de órdenes detenidas asignadas a él (FR-006, FR-007).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearCita, crearClienteConVehiculo, crearMantenimiento, crearOrdenDetenida, crearRefaccion, crearSegundoMecanico,
  crearUsuariosDePrueba, limpiarBase,
} from '../helpers.js';

let usuarios;
let otro;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  otro = await crearSegundoMecanico();
});
afterAll(cerrarConexiones);

const consultar = async (usuario) => (await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuario.token}`)).body.data;
const claves = (data) => data.groups.flatMap((g) => g.items.map((i) => i.key));

test('cada_mecanico_recibe_solo_su_orden_detenida', async () => {
  const mia = await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  const suya = await crearOrdenDetenida({ mechanicId: otro.id, createdBy: usuarios.ADMIN.id });
  expect(claves(await consultar(usuarios.MECHANIC))).toEqual([`ORDEN:${mia.id}`]);
  expect(claves(await consultar(otro))).toEqual([`ORDEN:${suya.id}`]);
});

test('reasignar_la_orden_mueve_el_aviso_al_nuevo_mecanico', async () => {
  const orden = await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  await pool.execute('UPDATE service_orders SET mechanicId = ? WHERE id = ?', [otro.id, orden.id]);
  expect(claves(await consultar(usuarios.MECHANIC))).not.toContain(`ORDEN:${orden.id}`);
  expect(claves(await consultar(otro))).toContain(`ORDEN:${orden.id}`);
});

test('aunque_existan_stock_citas_y_mantenimientos_el_mecanico_no_los_recibe', async () => {
  const { clientId, vehicleId } = await crearClienteConVehiculo({ km: 40000 });
  await crearCita({ clientId, vehicleId, createdBy: usuarios.ADMIN.id, dias: 0 });
  await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, nextMileage: 39000 });
  await crearRefaccion({ stock: 0, minimumStock: 2 });
  const data = await consultar(usuarios.MECHANIC);
  expect(data.groups.every((g) => g.type === 'ORDER_STALLED')).toBe(true);
  expect(data).not.toHaveProperty('stockAlerts');
  expect(data).not.toHaveProperty('clientsToNotify');
});

test('la_respuesta_no_incluye_datos_de_ordenes_de_otro_mecanico', async () => {
  const ajena = await crearOrdenDetenida({ mechanicId: otro.id, createdBy: usuarios.ADMIN.id });
  expect(JSON.stringify(await consultar(usuarios.MECHANIC))).not.toContain(ajena.licensePlate);
});
