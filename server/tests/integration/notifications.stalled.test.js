// Órdenes detenidas medidas con el último cambio de estado (FR-005, FR-006).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { cerrarConexiones, crearOrdenDetenida, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const crear = (dias, status) => crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, dias, status });
const claves = async (usuario) => {
  const r = await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuario.token}`);
  return (r.body.data.groups.find((g) => g.type === 'ORDER_STALLED')?.items ?? []).map((i) => i.key);
};

test('una_orden_con_cinco_dias_sin_cambio_aparece_y_una_reciente_no', async () => {
  const vieja = await crear(5);
  const reciente = await crear(1);
  const lista = await claves(usuarios.ADMIN);
  expect(lista).toContain(`ORDEN:${vieja.id}`);
  expect(lista).not.toContain(`ORDEN:${reciente.id}`);
});

test('editar_una_nota_sin_cambiar_de_estado_no_la_saca_ni_la_reinicia', async () => {
  const vieja = await crear(6);
  await pool.execute("UPDATE service_orders SET notes = 'Llegó la pieza', updatedAt = NOW() WHERE id = ?", [vieja.id]);
  expect(await claves(usuarios.ADMIN)).toContain(`ORDEN:${vieja.id}`);
});

test('sin_registros_en_el_historial_se_mide_desde_la_fecha_de_creacion', async () => {
  const vieja = await crear(0);
  await pool.execute('DELETE FROM order_status_history WHERE orderId = ?', [vieja.id]);
  await pool.execute('UPDATE service_orders SET createdAt = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE id = ?', [vieja.id]);
  expect(await claves(usuarios.ADMIN)).toContain(`ORDEN:${vieja.id}`);
});

test('las_terminadas_entregadas_y_canceladas_no_generan_aviso', async () => {
  const ids = [];
  for (const status of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) ids.push((await crear(10, status)).id);
  const lista = await claves(usuarios.ADMIN);
  for (const id of ids) expect(lista).not.toContain(`ORDEN:${id}`);
});

test('administrador_y_recepcion_ven_todas_las_ordenes_detenidas', async () => {
  const una = await crear(8);
  expect(await claves(usuarios.ADMIN)).toContain(`ORDEN:${una.id}`);
  expect(await claves(usuarios.RECEPTIONIST)).toContain(`ORDEN:${una.id}`);
});

test('el_detalle_informa_los_dias_detenida_y_el_estado', async () => {
  const una = await crear(7, 'ESPERANDO_REFACCION');
  const r = await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuarios.ADMIN.token}`);
  const item = r.body.data.groups.find((g) => g.type === 'ORDER_STALLED').items.find((i) => i.key === `ORDEN:${una.id}`);
  expect(item.data).toMatchObject({ daysStalled: 7, status: 'ESPERANDO_REFACCION', licensePlate: una.licensePlate });
  expect(item.detail).toContain('7');
});
