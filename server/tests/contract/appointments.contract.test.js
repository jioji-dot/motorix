// Pruebas de contrato de /api/appointments (ver specs/002-citas-ordenes-servicio/contracts/api.md).
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

const FORMA_CITA = {
  id: expect.any(Number),
  clientId: expect.any(Number),
  vehicleId: expect.any(Number),
  scheduledAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  reason: expect.any(String),
  notes: null,
  status: expect.stringMatching(/^(PENDIENTE|CONFIRMADA|EN_PROCESO|COMPLETADA|CANCELADA)$/),
  orderId: null,
  clientName: expect.any(String),
  vehiclePlate: expect.any(String),
  vehicleTitle: expect.any(String),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de citas', () => {
  test('test_el_listado_devuelve_data_y_meta', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ name: 'Ana Pérez' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'ABC123', brand: 'Nissan', model: 'Versa' });
    await createAppointment(cliente.id, vehiculo.id);

    const res = await request(app).get('/api/appointments').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        ...FORMA_CITA,
        clientName: 'Ana Pérez',
        vehiclePlate: 'ABC123',
        vehicleTitle: 'Nissan Versa'
      })
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_el_alta_responde_201_con_la_cita_en_estado_pendiente', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const cuando = futureDateTime(2, 9, 30);

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', auth)
      .send({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: cuando, reason: 'Cambio de aceite' });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_CITA, scheduledAt: cuando, status: 'PENDIENTE' })
    );
  });

  test('test_el_detalle_responde_la_cita', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const cita = await createAppointment(cliente.id, vehiculo.id, { notes: 'Traer llave extra' });

    const res = await request(app).get(`/api/appointments/${cita.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_CITA, id: cita.id, notes: 'Traer llave extra' })
    );
  });

  test('test_una_cita_inexistente_responde_404_con_el_formato_de_error', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/appointments/9999').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('test_la_edicion_responde_200_con_la_cita_actualizada', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const cita = await createAppointment(cliente.id, vehiculo.id);
    const nueva = futureDateTime(8, 11, 15);

    const res = await request(app)
      .patch(`/api/appointments/${cita.id}`)
      .set('Authorization', auth)
      .send({ scheduledAt: nueva, reason: 'Nuevo motivo' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_CITA, id: cita.id, scheduledAt: nueva, reason: 'Nuevo motivo' })
    );
  });

  test('test_confirmar_y_cancelar_responden_200_con_el_nuevo_estado', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const una = await createAppointment(cliente.id, vehiculo.id);
    const otra = await createAppointment(cliente.id, vehiculo.id);

    const confirmada = await request(app).post(`/api/appointments/${una.id}/confirm`).set('Authorization', auth);
    const cancelada = await request(app).post(`/api/appointments/${otra.id}/cancel`).set('Authorization', auth);

    expect(confirmada.status).toBe(200);
    expect(confirmada.body.data).toEqual(expect.objectContaining({ ...FORMA_CITA, status: 'CONFIRMADA' }));
    expect(cancelada.status).toBe(200);
    expect(cancelada.body.data).toEqual(expect.objectContaining({ ...FORMA_CITA, status: 'CANCELADA' }));
  });

  test('test_los_errores_de_estado_usan_el_formato_del_contrato', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const cita = await createAppointment(cliente.id, vehiculo.id, { status: 'CANCELADA' });

    const res = await request(app).post(`/api/appointments/${cita.id}/confirm`).set('Authorization', auth);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'APPOINTMENT_NOT_EDITABLE', message: expect.any(String) } });
  });

  test('test_el_aviso_de_coincidencia_incluye_las_citas_del_mismo_dia', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const existente = await createAppointment(cliente.id, vehiculo.id, {
      scheduledAt: futureDateTime(3, 9)
    });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', auth)
      .send({ clientId: cliente.id, vehicleId: vehiculo.id, scheduledAt: futureDateTime(3, 15), reason: 'Revisión' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'APPOINTMENT_DUPLICATE_WARNING',
        message: expect.any(String),
        details: { matches: [{ id: existente.id, scheduledAt: existente.scheduledAt }] }
      }
    });
  });

  test('test_la_validacion_fallida_lista_cada_campo_en_details', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const res = await request(app).post('/api/appointments').set('Authorization', auth).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['clientId', 'vehicleId', 'scheduledAt', 'reason'])
    );
  });
});
