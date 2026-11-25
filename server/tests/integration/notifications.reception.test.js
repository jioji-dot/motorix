// Avisos de mantenimientos y citas del día para recepción, con los mismos criterios del sistema (FR-002, FR-004, FR-006).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearCita, crearClienteConVehiculo, crearMantenimiento, crearRefaccion, crearUsuariosDePrueba, fechaDia, limpiarBase,
} from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const consultar = async (usuario) => (await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuario.token}`)).body.data;
const grupo = (data, tipo) => data.groups.find((g) => g.type === tipo);

test('mantenimientos_proximos_y_vencidos_con_los_limites_inclusivos', async () => {
  const { vehicleId } = await crearClienteConVehiculo({ km: 40000 });
  const admin = usuarios.ADMIN.id;
  const porKm = await crearMantenimiento({ vehicleId, createdBy: admin, serviceType: 'Km vencido', nextMileage: 40000 }); // 0 km: vencido
  const porFecha = await crearMantenimiento({ vehicleId, createdBy: admin, serviceType: 'Fecha vencida', nextDate: fechaDia(-1) });
  const justo15 = await crearMantenimiento({ vehicleId, createdBy: admin, serviceType: 'Quince dias', nextDate: fechaDia(15) });
  const justo500 = await crearMantenimiento({ vehicleId, createdBy: admin, serviceType: 'Quinientos km', nextMileage: 40500 });
  const lejos = await crearMantenimiento({ vehicleId, createdBy: admin, serviceType: 'Lejano', nextDate: fechaDia(16) });
  const atendido = await crearMantenimiento({ vehicleId, createdBy: admin, serviceType: 'Atendido', nextDate: fechaDia(-5), status: 'ATENDIDO' });

  const data = await consultar(usuarios.RECEPTIONIST);
  const claves = (tipo) => (grupo(data, tipo)?.items ?? []).map((i) => i.key);
  expect(claves('MAINTENANCE_OVERDUE')).toEqual(expect.arrayContaining([`MANT:${porKm}:VENCIDO`, `MANT:${porFecha}:VENCIDO`]));
  expect(claves('MAINTENANCE_SOON')).toEqual(expect.arrayContaining([`MANT:${justo15}:PROXIMO`, `MANT:${justo500}:PROXIMO`]));
  const todas = [...claves('MAINTENANCE_OVERDUE'), ...claves('MAINTENANCE_SOON')].join(' ');
  expect(todas).not.toContain(`MANT:${lejos}:`);
  expect(todas).not.toContain(`MANT:${atendido}:`);
});

test('cada_aviso_de_mantenimiento_trae_cliente_vehiculo_y_destino_sin_telefono', async () => {
  const data = await consultar(usuarios.RECEPTIONIST);
  const item = grupo(data, 'MAINTENANCE_OVERDUE').items[0];
  expect(item.data).toMatchObject({ serviceType: expect.any(String), client: { id: expect.any(Number), name: expect.any(String) }, vehicle: { licensePlate: expect.stringMatching(/^TST-/) } });
  expect(item.target).toMatchObject({ kind: 'maintenance', search: item.data.vehicle.licensePlate });
  expect(JSON.stringify(data)).not.toMatch(/phone/i);
});

test('un_cliente_desactivado_no_genera_avisos_de_mantenimiento', async () => {
  const { clientId, vehicleId } = await crearClienteConVehiculo({ km: 40000 });
  const id = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Desactivado', nextMileage: 39000 });
  await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [clientId]);
  const data = await consultar(usuarios.RECEPTIONIST);
  expect(JSON.stringify(data)).not.toContain(`MANT:${id}:`);
});

test('citas_de_hoy_pendientes_o_confirmadas_incluso_con_la_hora_pasada_y_ordenadas_por_hora', async () => {
  const { clientId, vehicleId } = await crearClienteConVehiculo();
  const por = usuarios.RECEPTIONIST.id;
  const tarde = await crearCita({ clientId, vehicleId, createdBy: por, status: 'PENDIENTE', dias: 0, hora: '18:30' });
  const temprano = await crearCita({ clientId, vehicleId, createdBy: por, status: 'CONFIRMADA', dias: 0, hora: '00:05' });
  const cancelada = await crearCita({ clientId, vehicleId, createdBy: por, status: 'CANCELADA', dias: 0, hora: '10:00' });
  const completada = await crearCita({ clientId, vehicleId, createdBy: por, status: 'COMPLETADA', dias: 0, hora: '11:00' });
  const manana = await crearCita({ clientId, vehicleId, createdBy: por, status: 'PENDIENTE', dias: 1, hora: '09:00' });

  const items = grupo(await consultar(usuarios.RECEPTIONIST), 'APPOINTMENT_TODAY').items;
  const claves = items.map((i) => i.key);
  expect(claves.indexOf(`CITA:${temprano}`)).toBeGreaterThanOrEqual(0);
  expect(claves.indexOf(`CITA:${temprano}`)).toBeLessThan(claves.indexOf(`CITA:${tarde}`));
  for (const id of [cancelada, completada, manana]) expect(claves).not.toContain(`CITA:${id}`);
  expect(items.find((i) => i.key === `CITA:${tarde}`)).toMatchObject({ target: { kind: 'appointment', id: tarde }, data: { time: '18:30' } });
});

test('recepcion_no_recibe_avisos_ni_conteo_de_stock', async () => {
  await crearRefaccion({ stock: 0, minimumStock: 2 });
  const data = await consultar(usuarios.RECEPTIONIST);
  expect(grupo(data, 'STOCK_OUT')).toBeUndefined();
  expect(grupo(data, 'STOCK_LOW')).toBeUndefined();
  expect(data).not.toHaveProperty('stockAlerts');
});
