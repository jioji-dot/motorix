// Lista de clientes por avisar: hechos pendientes con cliente, teléfono y motivo (FR-015, FR-016).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones, crearCita, crearClienteConVehiculo, crearMantenimiento, crearOrden, crearUsuariosDePrueba, envejecerOrden, fechaDia,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let orden;
let cita;
let proximo;
let vencido;
let cliente;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const por = usuarios.RECEPTIONIST.id;

  cliente = await crearClienteConVehiculo({ km: 40000, nombre: 'María López' });
  orden = await crearOrden({ ...cliente, mechanicId: usuarios.MECHANIC.id, createdBy: por, status: 'TERMINADO' });
  await envejecerOrden(orden, 10);

  const otro = await crearClienteConVehiculo();
  cita = await crearCita({ ...otro, createdBy: por, status: 'CONFIRMADA', dias: 1, hora: '09:00' });

  const tercero = await crearClienteConVehiculo({ km: 40000 });
  proximo = await crearMantenimiento({ vehicleId: tercero.vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Frenos', nextDate: fechaDia(2) });
  const cuarto = await crearClienteConVehiculo({ km: 40000 });
  vencido = await crearMantenimiento({ vehicleId: cuarto.vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Aceite', nextMileage: 39000 });
});
afterAll(cerrarConexiones);

const listar = (usuario, consulta = '') => request(app).get(`/api/client-notices${consulta}`).set('Authorization', `Bearer ${usuario.token}`);

test('sin_sesion_401_y_mecanico_403', async () => {
  expect((await request(app).get('/api/client-notices')).status).toBe(401);
  expect((await listar(usuarios.MECHANIC)).status).toBe(403);
});

test('recepcion_y_administrador_ven_los_cuatro_motivos_con_cliente_telefono_y_vehiculo', async () => {
  for (const usuario of [usuarios.RECEPTIONIST, usuarios.ADMIN]) {
    const r = await listar(usuario);
    expect(r.status).toBe(200);
    const porClave = Object.fromEntries(r.body.data.map((h) => [`${h.kind}:${h.factId}`, h]));
    expect(porClave[`ORDEN_LISTA:${orden}`]).toMatchObject({
      reason: 'Vehículo listo', client: { name: 'María López', phone: expect.stringMatching(/^\d{10}$/) },
      vehicle: { licensePlate: cliente.licensePlate }, target: { kind: 'order', id: orden },
    });
    expect(porClave[`CITA_MANANA:${cita}`]).toMatchObject({ reason: 'Cita de mañana', target: { kind: 'appointment', id: cita } });
    expect(porClave[`MANTENIMIENTO_PROXIMO:${proximo}`]).toMatchObject({ reason: 'Mantenimiento próximo', target: { kind: 'maintenance', id: proximo } });
    expect(porClave[`MANTENIMIENTO_VENCIDO:${vencido}`]).toMatchObject({ reason: 'Mantenimiento vencido' });
  }
});

test('ordena_por_fecha_del_hecho_con_el_mas_antiguo_primero', async () => {
  const r = await listar(usuarios.RECEPTIONIST);
  const posicion = (clave) => r.body.data.findIndex((h) => `${h.kind}:${h.factId}` === clave);
  expect(posicion(`ORDEN_LISTA:${orden}`)).toBeLessThan(posicion(`CITA_MANANA:${cita}`));
  expect(posicion(`CITA_MANANA:${cita}`)).toBeLessThan(posicion(`MANTENIMIENTO_PROXIMO:${proximo}`));
});

test('el_mantenimiento_solo_por_kilometraje_usa_su_fecha_de_registro', async () => {
  const r = await listar(usuarios.RECEPTIONIST);
  const hecho = r.body.data.find((h) => h.kind === 'MANTENIMIENTO_VENCIDO' && h.factId === vencido);
  expect(Number.isNaN(new Date(hecho.factDate).getTime())).toBe(false);
});

test('una_orden_terminada_aparece_con_o_sin_saldo_y_las_entregadas_no', async () => {
  const otro = await crearClienteConVehiculo();
  const entregada = await crearOrden({ ...otro, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: 'ENTREGADO' });
  const r = await listar(usuarios.RECEPTIONIST);
  expect(r.body.data.some((h) => h.kind === 'ORDEN_LISTA' && h.factId === entregada)).toBe(false);
  expect(r.body.data.some((h) => h.kind === 'ORDEN_LISTA' && h.factId === orden)).toBe(true);
});

test('excluye_a_los_clientes_desactivados', async () => {
  const otro = await crearClienteConVehiculo();
  const id = await crearOrden({ ...otro, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, status: 'TERMINADO' });
  await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [otro.clientId]);
  const r = await listar(usuarios.RECEPTIONIST);
  expect(r.body.data.some((h) => h.kind === 'ORDEN_LISTA' && h.factId === id)).toBe(false);
});

test('pagina_con_meta_y_valida_los_parametros', async () => {
  const r = await listar(usuarios.RECEPTIONIST, '?page=1&pageSize=2');
  expect(r.body.data).toHaveLength(2);
  expect(r.body.meta).toMatchObject({ page: 1, pageSize: 2, total: expect.any(Number) });
  expect(r.body.meta.total).toBeGreaterThanOrEqual(4);
  expect((await listar(usuarios.RECEPTIONIST, '?pageSize=500')).status).toBe(400);
});

test('el_centro_de_avisos_informa_cuantos_clientes_hay_por_avisar_solo_a_administracion_y_recepcion', async () => {
  const total = (await listar(usuarios.RECEPTIONIST)).body.meta.total;
  for (const usuario of [usuarios.ADMIN, usuarios.RECEPTIONIST]) {
    const r = await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuario.token}`);
    expect(r.body.data.clientsToNotify).toBe(total);
  }
  const m = await request(app).get('/api/notifications').set('Authorization', `Bearer ${usuarios.MECHANIC.token}`);
  expect(m.body.data).not.toHaveProperty('clientsToNotify');
});
