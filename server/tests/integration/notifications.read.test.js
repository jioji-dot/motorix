// Lectura de avisos por usuario: persiste, se descarta cuando el aviso desaparece y reaparece al cambiar de estado (FR-008, FR-009).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearClienteConVehiculo, crearMantenimiento, crearOrdenDetenida, crearRefaccion, crearUsuariosDePrueba, emitirToken,
  fechaDia, limpiarBase,
} from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const consultar = async (u) => (await request(app).get('/api/notifications').set(auth(u))).body.data;
const marcar = (u, key) => request(app).post('/api/notifications/read').set(auth(u)).send({ key });

test('marcar_como_leido_baja_el_contador_y_persiste_con_otra_sesion', async () => {
  const orden = await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  expect((await consultar(usuarios.ADMIN)).unread).toBe(1);
  const r = await marcar(usuarios.ADMIN, `ORDEN:${orden.id}`);
  expect(r.status).toBe(200);
  expect(r.body.data).toEqual({ key: `ORDEN:${orden.id}`, read: true });
  const otraSesion = { ...usuarios.ADMIN, token: emitirToken(usuarios.ADMIN.id) };
  const despues = await consultar(otraSesion);
  expect(despues.unread).toBe(0);
  expect(despues.total).toBe(1);
  expect(despues.groups[0].items[0].read).toBe(true);
});

test('la_lectura_es_por_usuario_y_marcar_dos_veces_no_duplica', async () => {
  const orden = await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id });
  await marcar(usuarios.ADMIN, `ORDEN:${orden.id}`);
  await marcar(usuarios.ADMIN, `ORDEN:${orden.id}`);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM notification_reads WHERE userId = ? AND noticeKey = ?', [usuarios.ADMIN.id, `ORDEN:${orden.id}`]);
  expect(n).toBe(1);
  const paraRecepcion = await consultar(usuarios.RECEPTIONIST);
  expect(paraRecepcion.groups[0].items.find((i) => i.key === `ORDEN:${orden.id}`).read).toBe(false);
});

test('una_clave_mal_formada_responde_400', async () => {
  const r = await marcar(usuarios.ADMIN, 'MANT:1:NORMAL');
  expect(r.status).toBe(400);
  expect(r.body.error.code).toBe('VALIDATION_ERROR');
  expect((await request(app).post('/api/notifications/read').set(auth(usuarios.ADMIN)).send({})).status).toBe(400);
});

test('un_tipo_ajeno_al_rol_responde_404_y_un_aviso_inexistente_de_un_tipo_permitido_responde_200_sin_efecto', async () => {
  const stock = await crearRefaccion({ stock: 0, minimumStock: 1 });
  const ajeno = await marcar(usuarios.MECHANIC, `STOCK:${stock.id}:AGOTADO`);
  expect(ajeno.status).toBe(404);
  const inexistente = await marcar(usuarios.MECHANIC, 'ORDEN:999999');
  expect(inexistente.status).toBe(200);
  expect(inexistente.body.data).toEqual({ key: 'ORDEN:999999', read: false });
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM notification_reads WHERE userId = ?', [usuarios.MECHANIC.id]);
  expect(n).toBe(0);
});

test('un_mecanico_no_puede_marcar_la_orden_de_otro', async () => {
  const otra = await crearOrdenDetenida({ mechanicId: usuarios.ADMIN.id, createdBy: usuarios.ADMIN.id });
  const r = await marcar(usuarios.MECHANIC, `ORDEN:${otra.id}`);
  expect(r.body.data.read).toBe(false);
});

test('al_atender_el_aviso_la_lectura_se_descarta_y_si_vuelve_a_cumplirse_reaparece_no_leido', async () => {
  const orden = await crearOrdenDetenida({ mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, dias: 4 });
  await marcar(usuarios.RECEPTIONIST, `ORDEN:${orden.id}`);
  await pool.execute('UPDATE order_status_history SET changedAt = NOW() WHERE orderId = ?', [orden.id]); // se atiende: ya no está detenida
  await consultar(usuarios.RECEPTIONIST);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM notification_reads WHERE userId = ? AND noticeKey = ?', [usuarios.RECEPTIONIST.id, `ORDEN:${orden.id}`]);
  expect(n).toBe(0);
  await pool.execute('UPDATE order_status_history SET changedAt = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE orderId = ?', [orden.id]);
  const item = (await consultar(usuarios.RECEPTIONIST)).groups[0].items.find((i) => i.key === `ORDEN:${orden.id}`);
  expect(item.read).toBe(false);
});

test('un_mantenimiento_que_pasa_de_proximo_a_vencido_reaparece_no_leido', async () => {
  const { vehicleId } = await crearClienteConVehiculo({ km: 40000 });
  const id = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Frenos', nextDate: fechaDia(3) });
  await marcar(usuarios.ADMIN, `MANT:${id}:PROXIMO`);
  await pool.execute('UPDATE maintenance SET nextDate = ? WHERE id = ?', [fechaDia(-1), id]);
  const data = await consultar(usuarios.ADMIN);
  const vencido = data.groups.find((g) => g.type === 'MAINTENANCE_OVERDUE').items.find((i) => i.key === `MANT:${id}:VENCIDO`);
  expect(vencido.read).toBe(false);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM notification_reads WHERE userId = ? AND noticeKey = ?', [usuarios.ADMIN.id, `MANT:${id}:PROXIMO`]);
  expect(n).toBe(0);
});
