// Marcar un cliente como avisado: registro único por hecho, quién y cuándo, sin enviar mensajes (FR-017 a FR-019).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearCita, crearClienteConVehiculo, crearMantenimiento, crearOrden, crearUsuariosDePrueba, fechaDia, limpiarBase,
} from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const marcar = (u, cuerpo) => request(app).post('/api/client-notices').set(auth(u)).send(cuerpo);
const lista = async () => (await request(app).get('/api/client-notices').set(auth(usuarios.RECEPTIONIST))).body.data;
const ordenTerminada = async (status = 'TERMINADO') => {
  const c = await crearClienteConVehiculo();
  return { ...c, id: await crearOrden({ ...c, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status }) };
};
const filas = async (kind, factId) => (await pool.query('SELECT * FROM client_notices WHERE kind = ? AND factId = ?', [kind, factId]))[0];

test('el_primer_aviso_responde_201_guarda_quien_y_cuando_y_saca_al_cliente_de_la_lista', async () => {
  const o = await ordenTerminada();
  const r = await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: o.id, note: 'No contestó' });
  expect(r.status).toBe(201);
  expect(r.body.data).toMatchObject({
    kind: 'ORDEN_LISTA', factId: o.id, note: 'No contestó',
    client: { id: o.clientId }, noticedBy: { id: usuarios.RECEPTIONIST.id, name: usuarios.RECEPTIONIST.name },
  });
  expect(new Date(r.body.data.noticedAt).getTime()).not.toBeNaN();
  expect((await lista()).some((h) => h.kind === 'ORDEN_LISTA' && h.factId === o.id)).toBe(false);
});

test('repetirlo_responde_200_con_el_registro_original_sin_duplicar', async () => {
  const o = await ordenTerminada();
  const primero = await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: o.id, note: 'Primera' });
  const segundo = await marcar(usuarios.ADMIN, { kind: 'ORDEN_LISTA', factId: o.id, note: 'Otra' });
  expect(segundo.status).toBe(200);
  expect(segundo.body.data).toMatchObject({ id: primero.body.data.id, note: 'Primera', noticedBy: { id: usuarios.RECEPTIONIST.id } });
  expect(await filas('ORDEN_LISTA', o.id)).toHaveLength(1);
});

test('dos_solicitudes_simultaneas_dejan_un_solo_registro', async () => {
  const o = await ordenTerminada();
  const cuerpo = { kind: 'ORDEN_LISTA', factId: o.id };
  const [a, b] = await Promise.all([marcar(usuarios.RECEPTIONIST, cuerpo), marcar(usuarios.ADMIN, cuerpo)]);
  expect([a.status, b.status].sort()).toEqual([200, 201]);
  expect(await filas('ORDEN_LISTA', o.id)).toHaveLength(1);
});

test('la_nota_es_opcional', async () => {
  const o = await ordenTerminada();
  const r = await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: o.id });
  expect(r.status).toBe(201);
  expect(r.body.data.note).toBeNull();
});

test('una_cita_de_manana_se_puede_marcar_y_una_cancelada_responde_409', async () => {
  const c = await crearClienteConVehiculo();
  const viva = await crearCita({ ...c, createdBy: usuarios.RECEPTIONIST.id, status: 'PENDIENTE', dias: 1 });
  const cancelada = await crearCita({ ...c, createdBy: usuarios.RECEPTIONIST.id, status: 'CANCELADA', dias: 1 });
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'CITA_MANANA', factId: viva })).status).toBe(201);
  const r = await marcar(usuarios.RECEPTIONIST, { kind: 'CITA_MANANA', factId: cancelada });
  expect(r.status).toBe(409);
  expect(r.body.error.code).toBe('NOTICE_NOT_APPLICABLE');
  expect(await filas('CITA_MANANA', cancelada)).toHaveLength(0);
});

test('una_orden_ya_entregada_responde_409_y_no_registra_nada', async () => {
  const o = await ordenTerminada('ENTREGADO');
  const r = await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: o.id });
  expect(r.status).toBe(409);
  expect(r.body.error.code).toBe('NOTICE_NOT_APPLICABLE');
  expect(await filas('ORDEN_LISTA', o.id)).toHaveLength(0);
});

test('un_objeto_inexistente_responde_404', async () => {
  for (const kind of ['ORDEN_LISTA', 'CITA_MANANA', 'MANTENIMIENTO_PROXIMO']) {
    expect((await marcar(usuarios.RECEPTIONIST, { kind, factId: 987654 })).status).toBe(404);
  }
});

test('un_hecho_nuevo_del_mismo_mantenimiento_aparece_de_nuevo', async () => {
  const c = await crearClienteConVehiculo({ km: 40000 });
  const id = await crearMantenimiento({ vehicleId: c.vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Llantas', nextDate: fechaDia(3) });
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'MANTENIMIENTO_PROXIMO', factId: id })).status).toBe(201);
  // el hecho Próximo ya no aplica si sigue Próximo con otra clasificación; al vencer es un hecho distinto
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'MANTENIMIENTO_VENCIDO', factId: id })).status).toBe(409);
  await pool.execute('UPDATE maintenance SET nextDate = ? WHERE id = ?', [fechaDia(-2), id]);
  expect((await lista()).some((h) => h.kind === 'MANTENIMIENTO_VENCIDO' && h.factId === id)).toBe(true);
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'MANTENIMIENTO_VENCIDO', factId: id })).status).toBe(201);
});

test('valida_el_motivo_el_hecho_y_el_largo_de_la_nota', async () => {
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'OTRO', factId: 1 })).status).toBe(400);
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: 'x' })).status).toBe(400);
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: 1, note: 'x'.repeat(256) })).status).toBe(400);
  const o = await ordenTerminada();
  expect((await marcar(usuarios.RECEPTIONIST, { kind: 'ORDEN_LISTA', factId: o.id, note: 'x'.repeat(255) })).status).toBe(201);
});

test('mecanico_403_y_sin_sesion_401', async () => {
  expect((await marcar(usuarios.MECHANIC, { kind: 'ORDEN_LISTA', factId: 1 })).status).toBe(403);
  expect((await request(app).post('/api/client-notices').send({ kind: 'ORDEN_LISTA', factId: 1 })).status).toBe(401);
});
