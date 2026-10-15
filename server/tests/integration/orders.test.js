// Pruebas de integración de la creación de órdenes (US3) contra la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAppointment,
  createAuthenticated,
  createClient,
  createMechanic,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const crear = (auth, cuerpo) => request(app).post('/api/orders').set('Authorization', auth).send(cuerpo);

async function escenario(vehiculo = {}) {
  const cliente = await createClient({ name: 'Ana Pérez' });
  const auto = await createVehicle(cliente.id, { licensePlate: 'ABC123', ...vehiculo });
  return { cliente, auto };
}

const valida = (cliente, auto, extra = {}) => ({
  clientId: cliente.id,
  vehicleId: auto.id,
  entryMileage: 15000,
  reportedProblem: 'Ruido al frenar',
  ...extra
});

const kilometrajeDe = async (vehicleId) => {
  const [[fila]] = await pool.query('SELECT current_mileage FROM vehicles WHERE id = ?', [vehicleId]);
  return fila.current_mileage;
};

beforeEach(cleanTables);
afterAll(closePool);

describe('alta de órdenes desde cero', () => {
  test('test_crea_la_orden_con_folio_estado_recibido_e_historial_inicial', async () => {
    const { auth, user } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();

    const res = await crear(auth, valida(cliente, auto));

    expect(res.status).toBe(201);
    const orden = res.body.data;
    expect(orden.folio).toBe(`OS-${String(orden.id).padStart(6, '0')}`);
    expect(orden.status).toBe('RECIBIDO');
    expect(orden.mechanicId).toBeNull();
    expect(orden.clientName).toBe('Ana Pérez');
    expect(orden.vehiclePlate).toBe('ABC123');
    expect(orden.statusHistory).toHaveLength(1);
    expect(orden.statusHistory[0]).toEqual(
      expect.objectContaining({ fromStatus: null, toStatus: 'RECIBIDO', changedBy: { id: user.id, name: user.name } })
    );
    const [[fila]] = await pool.query('SELECT created_by FROM service_orders WHERE id = ?', [orden.id]);
    expect(fila.created_by).toBe(user.id);
  });

  test('test_actualiza_el_kilometraje_del_vehiculo_con_el_de_entrada', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const { cliente, auto } = await escenario({ currentMileage: 10000 });

    await crear(auth, valida(cliente, auto, { entryMileage: 15000 }));

    expect(await kilometrajeDe(auto.id)).toBe(15000);
  });

  test('test_recorta_el_problema_reportado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();

    const res = await crear(auth, valida(cliente, auto, { reportedProblem: '  Ruido al frenar  ' }));

    expect(res.body.data.reportedProblem).toBe('Ruido al frenar');
  });

  test.each([
    ['sin kilometraje de entrada', { entryMileage: undefined }, 'entryMileage'],
    ['con kilometraje negativo', { entryMileage: -1 }, 'entryMileage'],
    ['con kilometraje decimal', { entryMileage: 10.5 }, 'entryMileage'],
    ['con kilometraje en texto', { entryMileage: '15000' }, 'entryMileage'],
    ['sin problema reportado', { reportedProblem: undefined }, 'reportedProblem'],
    ['con problema reportado vacío', { reportedProblem: '   ' }, 'reportedProblem'],
    ['con problema reportado de más de 1000 caracteres', { reportedProblem: 'a'.repeat(1001) }, 'reportedProblem'],
    ['sin cliente', { clientId: undefined }, 'clientId'],
    ['sin vehículo', { vehicleId: undefined }, 'vehicleId']
  ])('test_rechaza_una_orden_%s', async (_nombre, cambios, campo) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();

    const res = await crear(auth, valida(cliente, auto, cambios));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM service_orders');
    expect(total).toBe(0);
  });

  test('test_rechaza_una_orden_para_un_vehiculo_inexistente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente } = await escenario();

    const res = await crear(auth, valida(cliente, { id: 99999 }));

    expect(res.status).toBe(404);
    expect(res.body.error.details).toEqual({ field: 'vehicleId' });
  });

  test('test_rechaza_una_orden_para_un_cliente_inexistente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { auto } = await escenario();

    const res = await crear(auth, valida({ id: 99999 }, auto));

    expect(res.status).toBe(404);
    expect(res.body.error.details).toEqual({ field: 'clientId' });
  });

  test('test_rechaza_un_vehiculo_que_no_pertenece_al_cliente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente } = await escenario();
    const otro = await createClient();
    const ajeno = await createVehicle(otro.id);

    const res = await crear(auth, valida(cliente, ajeno));

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'vehicleId' })]));
  });

  test('test_el_mecanico_no_puede_crear_ordenes', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const { cliente, auto } = await escenario();

    const res = await crear(auth, valida(cliente, auto));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('test_exige_sesion_para_crear_ordenes', async () => {
    expect((await request(app).post('/api/orders').send({})).status).toBe(401);
  });
});

describe('validación del kilometraje de entrada', () => {
  test('test_rechaza_un_kilometraje_menor_al_registrado_sin_correccion_explicita', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario({ currentMileage: 50000 });

    const res = await crear(auth, valida(cliente, auto, { entryMileage: 40000 }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MILEAGE_DECREASE');
    expect(await kilometrajeDe(auto.id)).toBe(50000);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM service_orders');
    expect(total).toBe(0);
  });

  test('test_acepta_un_kilometraje_menor_con_correccion_explicita_y_actualiza_el_vehiculo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario({ currentMileage: 50000 });

    const res = await crear(auth, valida(cliente, auto, { entryMileage: 40000, mileageCorrection: true }));

    expect(res.status).toBe(201);
    expect(await kilometrajeDe(auto.id)).toBe(40000);
  });

  test('test_un_vehiculo_sin_kilometraje_previo_acepta_cualquier_valor_valido', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario({ currentMileage: 0 });

    const res = await crear(auth, valida(cliente, auto, { entryMileage: 87000 }));

    expect(res.status).toBe(201);
    expect(await kilometrajeDe(auto.id)).toBe(87000);
  });

  test('test_acepta_un_kilometraje_igual_al_registrado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario({ currentMileage: 20000 });

    const res = await crear(auth, valida(cliente, auto, { entryMileage: 20000 }));

    expect(res.status).toBe(201);
  });
});

describe('alta de órdenes desde una cita', () => {
  test('test_precarga_cliente_vehiculo_y_motivo_vincula_la_cita_y_la_pasa_a_en_proceso', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();
    const cita = await createAppointment(cliente.id, auto.id, { reason: 'Revisión de frenos' });

    const res = await crear(auth, { appointmentId: cita.id, entryMileage: 15000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        clientId: cliente.id,
        vehicleId: auto.id,
        reportedProblem: 'Revisión de frenos',
        appointmentId: cita.id
      })
    );
    const detalle = await request(app).get(`/api/appointments/${cita.id}`).set('Authorization', auth);
    expect(detalle.body.data.status).toBe('EN_PROCESO');
    expect(detalle.body.data.orderId).toBe(res.body.data.id);
  });

  test('test_acepta_citas_confirmadas_y_de_cualquier_fecha', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const { cliente, auto } = await escenario();
    const cita = await createAppointment(cliente.id, auto.id, {
      status: 'CONFIRMADA',
      scheduledAt: '2031-05-04T09:00'
    });

    const res = await crear(auth, { appointmentId: cita.id, entryMileage: 1000, reportedProblem: 'Afinación' });

    expect(res.status).toBe(201);
    expect(res.body.data.reportedProblem).toBe('Afinación');
  });

  test.each(['CANCELADA', 'EN_PROCESO', 'COMPLETADA'])(
    'test_rechaza_una_cita_en_estado_%s',
    async (estado) => {
      const { auth } = await createAuthenticated('RECEPTIONIST');
      const { cliente, auto } = await escenario();
      const cita = await createAppointment(cliente.id, auto.id, { status: estado });

      const res = await crear(auth, { appointmentId: cita.id, entryMileage: 15000 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('APPOINTMENT_NOT_AVAILABLE');
    }
  );

  test('test_rechaza_una_cita_que_ya_tiene_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();
    const cita = await createAppointment(cliente.id, auto.id);
    expect((await crear(auth, { appointmentId: cita.id, entryMileage: 15000 })).status).toBe(201);

    const segunda = await crear(auth, { appointmentId: cita.id, entryMileage: 15000 });

    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('APPOINTMENT_NOT_AVAILABLE');
  });

  test('test_rechaza_una_cita_inexistente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await crear(auth, { appointmentId: 99999, entryMileage: 15000 });

    expect(res.status).toBe(404);
    expect(res.body.error.details).toEqual({ field: 'appointmentId' });
  });

  test('test_rechaza_un_cliente_distinto_al_de_la_cita', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();
    const otro = await createClient();
    const cita = await createAppointment(cliente.id, auto.id);

    const res = await crear(auth, { appointmentId: cita.id, clientId: otro.id, entryMileage: 15000 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('clientId');
  });

  test('test_con_dos_altas_simultaneas_de_la_misma_cita_solo_se_crea_una_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();
    const cita = await createAppointment(cliente.id, auto.id);

    const [a, b] = await Promise.all([
      crear(auth, { appointmentId: cita.id, entryMileage: 15000 }),
      crear(auth, { appointmentId: cita.id, entryMileage: 15000 })
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM service_orders');
    expect(total).toBe(1);
  });

  test('test_una_falla_de_kilometraje_deja_la_cita_intacta', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario({ currentMileage: 50000 });
    const cita = await createAppointment(cliente.id, auto.id);

    const res = await crear(auth, { appointmentId: cita.id, entryMileage: 100 });

    expect(res.status).toBe(409);
    const detalle = await request(app).get(`/api/appointments/${cita.id}`).set('Authorization', auth);
    expect(detalle.body.data.status).toBe('PENDIENTE');
    expect(detalle.body.data.orderId).toBeNull();
  });
});

describe('folios', () => {
  test('test_las_altas_concurrentes_reciben_folios_distintos', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();

    const respuestas = await Promise.all(
      Array.from({ length: 8 }, () => crear(auth, valida(cliente, auto)))
    );

    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    const folios = respuestas.map((r) => r.body.data.folio);
    expect(new Set(folios).size).toBe(8);
    for (const folio of folios) expect(folio).toMatch(/^OS-\d{6}$/);
  });

  test('test_crea_la_orden_asignada_a_un_mecanico_activo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto } = await escenario();
    const mecanico = await createMechanic({ name: 'Mario Mecánico' });

    const res = await crear(auth, valida(cliente, auto, { mechanicId: mecanico.id }));

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ mechanicId: mecanico.id, mechanicName: 'Mario Mecánico' }));
  });
});
