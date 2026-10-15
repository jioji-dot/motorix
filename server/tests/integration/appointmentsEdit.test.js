// Pruebas de integración de modificar, confirmar y cancelar citas (US2) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAppointment,
  createAuthenticated,
  createClient,
  createVehicle,
  futureDateTime
} from '../helpers/factories.js';

const app = createApp();

const editar = (auth, id, cuerpo) => request(app).patch(`/api/appointments/${id}`).set('Authorization', auth).send(cuerpo);
const confirmar = (auth, id) => request(app).post(`/api/appointments/${id}/confirm`).set('Authorization', auth);
const cancelar = (auth, id) => request(app).post(`/api/appointments/${id}/cancel`).set('Authorization', auth);
const detalle = (auth, id) => request(app).get(`/api/appointments/${id}`).set('Authorization', auth);
const crearOrden = (auth, cuerpo) => request(app).post('/api/orders').set('Authorization', auth).send(cuerpo);

async function escenario(estado = 'PENDIENTE') {
  const cliente = await createClient({ name: 'Ana Pérez' });
  const auto = await createVehicle(cliente.id);
  const cita = await createAppointment(cliente.id, auto.id, { status: estado, reason: 'Cambio de aceite' });
  return { cliente, auto, cita };
}

beforeEach(cleanTables);
afterAll(closePool);

describe('modificar citas', () => {
  test.each(['PENDIENTE', 'CONFIRMADA'])('test_modifica_fecha_hora_motivo_y_observaciones_de_una_cita_%s', async (estado) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario(estado);
    const nueva = futureDateTime(9, 15, 30);

    const res = await editar(auth, cita.id, { scheduledAt: nueva, reason: ' Frenos ', notes: 'Llegará tarde' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ scheduledAt: nueva, reason: 'Frenos', notes: 'Llegará tarde', status: estado })
    );
    expect((await detalle(auth, cita.id)).body.data.scheduledAt).toBe(nueva);
  });

  test('test_una_edicion_parcial_conserva_los_demas_datos_y_permite_borrar_las_observaciones', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const { cita } = await escenario();
    await editar(auth, cita.id, { notes: 'Traer llave' });

    const motivo = await editar(auth, cita.id, { reason: 'Revisión completa' });
    const sinNotas = await editar(auth, cita.id, { notes: '' });

    expect(motivo.body.data).toEqual(
      expect.objectContaining({ reason: 'Revisión completa', notes: 'Traer llave', scheduledAt: cita.scheduledAt })
    );
    expect(sinNotas.body.data.notes).toBeNull();
  });

  test.each([
    ['con fecha en el pasado', { scheduledAt: '2020-01-10T10:00' }, 'scheduledAt'],
    ['con fecha a más de un año', { scheduledAt: futureDateTime(367, 10) }, 'scheduledAt'],
    ['con fecha inválida', { scheduledAt: '10/01/2030' }, 'scheduledAt'],
    ['con motivo vacío', { reason: '  ' }, 'reason'],
    ['con motivo demasiado largo', { reason: 'a'.repeat(256) }, 'reason'],
    ['con observaciones demasiado largas', { notes: 'a'.repeat(501) }, 'notes']
  ])('test_rechaza_modificar_%s', async (_nombre, cuerpo, campo) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();

    const res = await editar(auth, cita.id, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    expect((await detalle(auth, cita.id)).body.data.reason).toBe('Cambio de aceite');
  });

  test('test_no_acepta_cambiar_el_cliente_ni_el_vehiculo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();
    const otro = await createClient();
    const otroAuto = await createVehicle(otro.id);

    const cliente = await editar(auth, cita.id, { clientId: otro.id });
    const vehiculo = await editar(auth, cita.id, { vehicleId: otroAuto.id });

    expect(cliente.status).toBe(400);
    expect(cliente.body.error.details.map((d) => d.field)).toContain('clientId');
    expect(vehiculo.status).toBe(400);
    expect(vehiculo.body.error.details.map((d) => d.field)).toContain('vehicleId');
  });

  test('test_una_edicion_vacia_responde_400', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();

    expect((await editar(auth, cita.id, {})).status).toBe(400);
  });

  test.each(['EN_PROCESO', 'COMPLETADA', 'CANCELADA'])('test_no_se_modifica_una_cita_%s', async (estado) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario(estado);

    const res = await editar(auth, cita.id, { reason: 'Cambio' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_EDITABLE');
    expect((await detalle(auth, cita.id)).body.data.reason).toBe('Cambio de aceite');
  });

  test('test_avisa_si_la_nueva_fecha_coincide_con_otra_cita_del_mismo_vehiculo_y_permite_confirmar', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cliente, auto, cita } = await escenario();
    const otra = await createAppointment(cliente.id, auto.id, { scheduledAt: futureDateTime(12, 9) });

    const aviso = await editar(auth, cita.id, { scheduledAt: futureDateTime(12, 16) });
    const confirmada = await editar(auth, cita.id, { scheduledAt: futureDateTime(12, 16), confirmDuplicate: true });

    expect(aviso.status).toBe(409);
    expect(aviso.body.error.code).toBe('APPOINTMENT_DUPLICATE_WARNING');
    expect(aviso.body.error.details.matches.map((m) => m.id)).toEqual([otra.id]);
    expect(confirmada.status).toBe(200);
  });

  test('test_no_se_avisa_de_coincidencia_consigo_misma_al_cambiar_solo_la_hora_del_mismo_dia', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const auto = await createVehicle(cliente.id);
    const cita = await createAppointment(cliente.id, auto.id, { scheduledAt: futureDateTime(5, 9) });

    const res = await editar(auth, cita.id, { scheduledAt: futureDateTime(5, 17) });

    expect(res.status).toBe(200);
  });

  test('test_una_cita_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    expect((await editar(auth, 99999, { reason: 'x' })).status).toBe(404);
    expect((await confirmar(auth, 99999)).status).toBe(404);
    expect((await cancelar(auth, 99999)).status).toBe(404);
  });
});

describe('confirmar citas', () => {
  test('test_confirma_una_cita_pendiente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario('PENDIENTE');

    const res = await confirmar(auth, cita.id);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMADA');
  });

  test.each(['CONFIRMADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'])(
    'test_no_se_puede_confirmar_una_cita_%s',
    async (estado) => {
      const { auth } = await createAuthenticated('RECEPTIONIST');
      const { cita } = await escenario(estado);

      const res = await confirmar(auth, cita.id);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('APPOINTMENT_NOT_EDITABLE');
    }
  );
});

describe('cancelar citas', () => {
  test.each(['PENDIENTE', 'CONFIRMADA'])('test_cancela_una_cita_%s_sin_orden_y_la_conserva', async (estado) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario(estado);

    const res = await cancelar(auth, cita.id);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELADA');
    expect((await detalle(auth, cita.id)).status).toBe(200);
    const lista = await request(app).get('/api/appointments?status=CANCELADA').set('Authorization', auth);
    expect(lista.body.data.map((c) => c.id)).toEqual([cita.id]);
  });

  test('test_una_cita_cancelada_ya_no_se_modifica_ni_se_confirma_ni_se_cancela_otra_vez', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();
    await cancelar(auth, cita.id);

    expect((await editar(auth, cita.id, { reason: 'x' })).status).toBe(409);
    expect((await confirmar(auth, cita.id)).status).toBe(409);
    expect((await cancelar(auth, cita.id)).status).toBe(409);
  });

  test('test_no_se_cancela_una_cita_que_ya_tiene_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();
    await crearOrden(auth, { appointmentId: cita.id, entryMileage: 1000 });

    const res = await cancelar(auth, cita.id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPOINTMENT_HAS_ORDER');
    expect((await detalle(auth, cita.id)).body.data.status).toBe('EN_PROCESO');
  });

  test.each(['COMPLETADA', 'EN_PROCESO'])('test_no_se_cancela_una_cita_%s', async (estado) => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario(estado);

    const res = await cancelar(auth, cita.id);

    expect(res.status).toBe(409);
  });

  test('test_una_cita_cancelada_no_permite_crear_una_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();
    await cancelar(auth, cita.id);

    const res = await crearOrden(auth, { appointmentId: cita.id, entryMileage: 1000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPOINTMENT_NOT_AVAILABLE');
  });

  test('test_cancelar_y_crear_la_orden_a_la_vez_deja_un_resultado_coherente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const { cita } = await escenario();

    const [cancelacion, orden] = await Promise.all([
      cancelar(auth, cita.id),
      crearOrden(auth, { appointmentId: cita.id, entryMileage: 1000 })
    ]);

    const final = (await detalle(auth, cita.id)).body.data;
    if (cancelacion.status === 200) {
      expect(orden.status).toBe(409);
      expect(final.status).toBe('CANCELADA');
      expect(final.orderId).toBeNull();
    } else {
      expect(cancelacion.status).toBe(409);
      expect(orden.status).toBe(201);
      expect(final.status).toBe('EN_PROCESO');
      expect(final.orderId).toBe(orden.body.data.id);
    }
  });

  test('test_no_existe_una_ruta_para_eliminar_citas', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const { cita } = await escenario();

    const res = await request(app).delete(`/api/appointments/${cita.id}`).set('Authorization', auth);

    expect([404, 405]).toContain(res.status);
    expect((await detalle(auth, cita.id)).status).toBe(200);
  });
});

describe('permisos', () => {
  test('test_el_mecanico_recibe_403_en_modificar_confirmar_y_cancelar', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const { cita } = await escenario();

    for (const res of [await editar(auth, cita.id, { reason: 'x' }), await confirmar(auth, cita.id), await cancelar(auth, cita.id)]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  test('test_exige_sesion', async () => {
    expect((await request(app).patch('/api/appointments/1').send({ reason: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/appointments/1/confirm')).status).toBe(401);
    expect((await request(app).post('/api/appointments/1/cancel')).status).toBe(401);
  });
});
