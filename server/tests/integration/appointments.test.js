// Pruebas de integración de citas (US1 y US2) contra la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAppointment,
  createAuthenticated,
  createClient,
  createVehicle,
  futureDateTime
} from '../helpers/factories.js';

const app = createApp();

const crear = (auth, cuerpo) => request(app).post('/api/appointments').set('Authorization', auth).send(cuerpo);
const listar = (auth, query = '') => request(app).get(`/api/appointments${query}`).set('Authorization', auth);

async function escenario() {
  const cliente = await createClient({ name: 'Ana Pérez' });
  const vehiculo = await createVehicle(cliente.id, { licensePlate: 'ABC123' });
  return { cliente, vehiculo };
}

const valida = (cliente, vehiculo, extra = {}) => ({
  clientId: cliente.id,
  vehicleId: vehiculo.id,
  scheduledAt: futureDateTime(2, 10),
  reason: 'Cambio de aceite',
  ...extra
});

beforeEach(cleanTables);
afterAll(closePool);

describe('alta de citas', () => {
  test('test_registra_una_cita_pendiente_y_aparece_en_el_listado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();

    const res = await crear(auth, valida(cliente, vehiculo, { notes: '  Traer llave extra ' }));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ status: 'PENDIENTE', orderId: null, notes: 'Traer llave extra', reason: 'Cambio de aceite' })
    );
    expect((await listar(auth)).body.data.map((c) => c.id)).toEqual([res.body.data.id]);
  });

  test('test_el_administrador_tambien_puede_registrar_citas', async () => {
    const { auth, user } = await createAuthenticated('ADMIN');
    const { cliente, vehiculo } = await escenario();

    const res = await crear(auth, valida(cliente, vehiculo));

    expect(res.status).toBe(201);
    const [[fila]] = await pool.query('SELECT created_by FROM appointments WHERE id = ?', [res.body.data.id]);
    expect(fila.created_by).toBe(user.id);
  });

  test('test_conserva_la_hora_local_de_pared_sin_desfases', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    const cuando = futureDateTime(5, 23, 45);

    const res = await crear(auth, valida(cliente, vehiculo, { scheduledAt: cuando }));

    expect(res.body.data.scheduledAt).toBe(cuando);
    const detalle = await request(app).get(`/api/appointments/${res.body.data.id}`).set('Authorization', auth);
    expect(detalle.body.data.scheduledAt).toBe(cuando);
  });

  test.each([
    ['sin motivo', { reason: undefined }, 'reason'],
    ['con motivo vacío', { reason: '   ' }, 'reason'],
    ['con motivo de más de 255 caracteres', { reason: 'a'.repeat(256) }, 'reason'],
    ['con observaciones de más de 500 caracteres', { notes: 'a'.repeat(501) }, 'notes'],
    ['sin fecha', { scheduledAt: undefined }, 'scheduledAt'],
    ['con fecha sin hora', { scheduledAt: '2030-01-10' }, 'scheduledAt'],
    ['con fecha inexistente', { scheduledAt: '2030-02-30T10:00' }, 'scheduledAt'],
    ['con hora inválida', { scheduledAt: '2030-01-10T25:00' }, 'scheduledAt'],
    ['con zona horaria', { scheduledAt: '2030-01-10T10:00:00Z' }, 'scheduledAt'],
    ['en el pasado', { scheduledAt: '2020-01-10T10:00' }, 'scheduledAt'],
    ['a más de un año de distancia', { scheduledAt: futureDateTime(367, 10) }, 'scheduledAt'],
    ['sin cliente', { clientId: undefined }, 'clientId'],
    ['sin vehículo', { vehicleId: undefined }, 'vehicleId']
  ])('test_rechaza_una_cita_%s', async (_nombre, cambios, campo) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();

    const res = await crear(auth, valida(cliente, vehiculo, cambios));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    expect((await listar(auth)).body.meta.total).toBe(0);
  });

  test('test_acepta_una_cita_dentro_del_limite_de_un_anio', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();

    const res = await crear(auth, valida(cliente, vehiculo, { scheduledAt: futureDateTime(364, 10) }));

    expect(res.status).toBe(201);
  });

  test('test_rechaza_un_vehiculo_que_no_pertenece_al_cliente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente } = await escenario();
    const otroCliente = await createClient();
    const ajeno = await createVehicle(otroCliente.id);

    const res = await crear(auth, valida(cliente, ajeno));

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'vehicleId' })]));
  });

  test('test_rechaza_clientes_y_vehiculos_inexistentes', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();

    const sinCliente = await crear(auth, valida({ id: 99999 }, vehiculo));
    const sinVehiculo = await crear(auth, valida(cliente, { id: 99999 }));

    expect(sinCliente.status).toBe(404);
    expect(sinCliente.body.error.details).toEqual({ field: 'clientId' });
    expect(sinVehiculo.status).toBe(404);
    expect(sinVehiculo.body.error.details).toEqual({ field: 'vehicleId' });
  });

  test('test_avisa_si_el_vehiculo_ya_tiene_otra_cita_el_mismo_dia_y_permite_confirmar', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    const primera = await crear(auth, valida(cliente, vehiculo, { scheduledAt: futureDateTime(4, 9) }));

    const aviso = await crear(auth, valida(cliente, vehiculo, { scheduledAt: futureDateTime(4, 16) }));
    const confirmada = await crear(
      auth,
      valida(cliente, vehiculo, { scheduledAt: futureDateTime(4, 16), confirmDuplicate: true })
    );

    expect(aviso.status).toBe(409);
    expect(aviso.body.error.code).toBe('APPOINTMENT_DUPLICATE_WARNING');
    expect(aviso.body.error.details.matches.map((m) => m.id)).toEqual([primera.body.data.id]);
    expect(confirmada.status).toBe(201);
    expect((await listar(auth)).body.meta.total).toBe(2);
  });

  test('test_el_aviso_no_cuenta_citas_canceladas_ni_de_otros_dias_ni_de_otros_vehiculos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    const otroVehiculo = await createVehicle(cliente.id);
    await createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(6, 9), status: 'CANCELADA' });
    await createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(7, 9) });
    await createAppointment(cliente.id, otroVehiculo.id, { scheduledAt: futureDateTime(6, 11) });

    const res = await crear(auth, valida(cliente, vehiculo, { scheduledAt: futureDateTime(6, 14) }));

    expect(res.status).toBe(201);
  });

  test('test_el_mecanico_no_puede_registrar_ni_consultar_citas', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const { cliente, vehiculo } = await escenario();
    const cita = await createAppointment(cliente.id, vehiculo.id);

    const respuestas = [
      await crear(auth, valida(cliente, vehiculo)),
      await listar(auth),
      await request(app).get(`/api/appointments/${cita.id}`).set('Authorization', auth)
    ];

    for (const res of respuestas) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  test('test_exige_sesion_en_todas_las_rutas_de_citas', async () => {
    expect((await request(app).get('/api/appointments')).status).toBe(401);
    expect((await request(app).post('/api/appointments').send({})).status).toBe(401);
    expect((await request(app).get('/api/appointments/1')).status).toBe(401);
  });
});

describe('consulta de citas', () => {
  async function citasDeEjemplo() {
    const ana = await createClient({ name: 'Ana Pérez' });
    const luis = await createClient({ name: 'Luis Gómez' });
    const v1 = await createVehicle(ana.id, { licensePlate: 'AAA111' });
    const v2 = await createVehicle(luis.id, { licensePlate: 'BBB222' });
    const tarde = await createAppointment(ana.id, v1.id, { scheduledAt: futureDateTime(3, 16), reason: 'Frenos' });
    const temprano = await createAppointment(ana.id, v1.id, { scheduledAt: futureDateTime(3, 9), reason: 'Aceite' });
    const otroDia = await createAppointment(luis.id, v2.id, {
      scheduledAt: futureDateTime(5, 12),
      reason: 'Llantas',
      status: 'CONFIRMADA'
    });
    return { ana, luis, v1, v2, tarde, temprano, otroDia };
  }

  test('test_ordena_por_fecha_y_hora', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { tarde, temprano, otroDia } = await citasDeEjemplo();

    const res = await listar(auth);

    expect(res.body.data.map((c) => c.id)).toEqual([temprano.id, tarde.id, otroDia.id]);
  });

  test('test_filtra_por_fecha', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { tarde, temprano } = await citasDeEjemplo();

    const res = await listar(auth, `?date=${futureDateTime(3).slice(0, 10)}`);

    expect(res.body.data.map((c) => c.id)).toEqual([temprano.id, tarde.id]);
  });

  test('test_filtra_por_rango_de_fechas', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { otroDia } = await citasDeEjemplo();

    const res = await listar(auth, `?from=${futureDateTime(4).slice(0, 10)}&to=${futureDateTime(6).slice(0, 10)}`);

    expect(res.body.data.map((c) => c.id)).toEqual([otroDia.id]);
  });

  test('test_filtra_por_estado_cliente_y_vehiculo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { ana, luis, v2, otroDia } = await citasDeEjemplo();

    expect((await listar(auth, '?status=CONFIRMADA')).body.data.map((c) => c.id)).toEqual([otroDia.id]);
    expect((await listar(auth, `?clientId=${luis.id}`)).body.data.map((c) => c.id)).toEqual([otroDia.id]);
    expect((await listar(auth, `?vehicleId=${v2.id}`)).body.data.map((c) => c.id)).toEqual([otroDia.id]);
    expect((await listar(auth, `?clientId=${ana.id}`)).body.meta.total).toBe(2);
  });

  test('test_busca_por_nombre_del_cliente_o_por_placa', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { otroDia, temprano, tarde } = await citasDeEjemplo();

    expect((await listar(auth, '?search=gómez')).body.data.map((c) => c.id)).toEqual([otroDia.id]);
    expect((await listar(auth, '?search=bbb')).body.data.map((c) => c.id)).toEqual([otroDia.id]);
    expect((await listar(auth, '?search=aaa-111')).body.data.map((c) => c.id)).toEqual([temprano.id, tarde.id]);
    expect((await listar(auth, '?search=zzz')).body.data).toEqual([]);
  });

  test('test_rechaza_filtros_con_formato_invalido', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    expect((await listar(auth, '?date=20/10/2026')).status).toBe(400);
    expect((await listar(auth, '?status=OTRO')).status).toBe(400);
    expect((await listar(auth, '?from=hoy')).status).toBe(400);
  });

  test('test_pagina_el_listado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, vehiculo } = await escenario();
    for (let i = 0; i < 25; i += 1) await createAppointment(cliente.id, vehiculo.id);

    const res = await listar(auth, '?page=2&pageSize=10');

    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 10, total: 25 });
  });
});
