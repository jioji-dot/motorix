// Las cifras del centro de avisos coinciden con las del panel de control, Mantenimientos e Inventario (FR-004, FR-013, SC-002).
import request from 'supertest';
import { app } from '../../app.js';
import {
  cerrarConexiones, crearCita, crearClienteConVehiculo, crearMantenimiento, crearRefaccion, crearUsuariosDePrueba, fechaDia, limpiarBase,
} from '../helpers.js';

let admin;

beforeAll(async () => {
  await limpiarBase();
  const usuarios = await crearUsuariosDePrueba();
  admin = usuarios.ADMIN;
  const { clientId, vehicleId } = await crearClienteConVehiculo({ km: 40000 });
  const creador = admin.id;
  await crearMantenimiento({ vehicleId, createdBy: creador, serviceType: 'A', nextMileage: 39000 });
  await crearMantenimiento({ vehicleId, createdBy: creador, serviceType: 'B', nextDate: fechaDia(-3) });
  await crearMantenimiento({ vehicleId, createdBy: creador, serviceType: 'C', nextDate: fechaDia(4) });
  await crearMantenimiento({ vehicleId, createdBy: creador, serviceType: 'D', nextMileage: 40400 });
  await crearMantenimiento({ vehicleId, createdBy: creador, serviceType: 'E', nextDate: fechaDia(80) });
  await crearCita({ clientId, vehicleId, createdBy: creador, status: 'PENDIENTE', dias: 0, hora: '08:00' });
  await crearCita({ clientId, vehicleId, createdBy: creador, status: 'CONFIRMADA', dias: 0, hora: '17:00' });
  await crearCita({ clientId, vehicleId, createdBy: creador, status: 'CANCELADA', dias: 0, hora: '12:00' });
  await crearRefaccion({ stock: 0, minimumStock: 2 });
  await crearRefaccion({ stock: 0, minimumStock: 2 });
  await crearRefaccion({ stock: 1, minimumStock: 2 });
  await crearRefaccion({ stock: 0, minimumStock: 2, active: 0 });
});
afterAll(cerrarConexiones);

const get = async (ruta) => (await request(app).get(ruta).set('Authorization', `Bearer ${admin.token}`)).body;
const total = (data, tipo) => data.groups.find((g) => g.type === tipo)?.total ?? 0;

test('los_mantenimientos_coinciden_con_el_panel_de_control_y_con_la_lista_de_mantenimientos', async () => {
  const avisos = (await get('/api/notifications')).data;
  const panel = (await get('/api/dashboard')).data;
  const vencidos = (await get('/api/maintenance?status=PENDIENTE&classification=VENCIDO')).meta.total;
  const proximos = (await get('/api/maintenance?status=PENDIENTE&classification=PROXIMO')).meta.total;
  expect(total(avisos, 'MAINTENANCE_OVERDUE')).toBe(panel.maintenance.overdue);
  expect(total(avisos, 'MAINTENANCE_SOON')).toBe(panel.maintenance.soon);
  expect(total(avisos, 'MAINTENANCE_OVERDUE')).toBe(vencidos);
  expect(total(avisos, 'MAINTENANCE_SOON')).toBe(proximos);
  expect(vencidos).toBe(2);
  expect(proximos).toBe(2);
});

test('las_citas_de_hoy_coinciden_con_el_panel_de_control', async () => {
  const avisos = (await get('/api/notifications')).data;
  const panel = (await get('/api/dashboard')).data;
  expect(total(avisos, 'APPOINTMENT_TODAY')).toBe(panel.appointments.today);
  expect(panel.appointments.today).toBe(2);
});

test('el_stock_coincide_con_el_resumen_de_inventario_y_con_la_insignia', async () => {
  const avisos = (await get('/api/notifications')).data;
  const resumen = (await get('/api/parts/summary')).data;
  const panel = (await get('/api/dashboard')).data;
  expect(total(avisos, 'STOCK_OUT')).toBe(resumen.out);
  expect(total(avisos, 'STOCK_LOW')).toBe(resumen.low);
  expect(avisos.stockAlerts).toBe(resumen.out + resumen.low);
  expect(panel.inventory).toMatchObject({ out: resumen.out, low: resumen.low });
  expect(resumen).toMatchObject({ out: 2, low: 1 });
});
