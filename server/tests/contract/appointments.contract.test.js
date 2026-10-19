// Contrato de /api/appointments (specs/002-citas-ordenes-servicio/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearUsuariosDePrueba, fechaLocal, limpiarBase } from '../helpers.js';

let admin;
let datos;
const auth = () => ({ Authorization: `Bearer ${admin.token}` });

const FORMA_CITA = {
  id: expect.any(Number),
  clientId: expect.any(Number),
  vehicleId: expect.any(Number),
  scheduledAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
  reason: expect.any(String),
  notes: null,
  status: expect.stringMatching(/^(PENDIENTE|CONFIRMADA|EN_PROCESO|COMPLETADA|CANCELADA)$/),
  orderId: null,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  client: { id: expect.any(Number), name: expect.any(String), phone: expect.stringMatching(/^\d{10}$/) },
  vehicle: {
    id: expect.any(Number),
    brand: expect.any(String),
    model: expect.any(String),
    year: expect.any(Number),
    licensePlate: expect.any(String),
  },
};

beforeAll(async () => {
  await limpiarBase();
  admin = (await crearUsuariosDePrueba()).ADMIN;
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

const NUEVA = () => ({ clientId: datos.clientId, vehicleId: datos.vehicleId, scheduledAt: fechaLocal(30, '10:00'), reason: 'Contrato' });

describe('POST /api/appointments', () => {
  test('responde_201_con_la_cita_pendiente_y_los_datos_de_cliente_y_vehiculo', async () => {
    const respuesta = await request(app).post('/api/appointments').set(auth()).send(NUEVA());
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ data: { ...FORMA_CITA, status: 'PENDIENTE', reason: 'Contrato' } });
  });

  test('responde_400_con_detalles_por_campo', async () => {
    const respuesta = await request(app).post('/api/appointments').set(auth()).send({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['clientId', 'vehicleId', 'scheduledAt', 'reason']),
    );
  });

  test('responde_404_con_error_estandar_si_el_cliente_no_existe', async () => {
    const respuesta = await request(app).post('/api/appointments').set(auth()).send({ ...NUEVA(), clientId: 987654 });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('responde_409_DUPLICATE_APPOINTMENT_con_la_cita_existente_en_details', async () => {
    const respuesta = await request(app).post('/api/appointments').set(auth()).send(NUEVA());
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: {
        code: 'DUPLICATE_APPOINTMENT',
        message: expect.any(String),
        details: [{ id: expect.any(Number), scheduledAt: expect.any(String), status: 'PENDIENTE' }],
      },
    });
  });
});

describe('GET /api/appointments', () => {
  test('responde_200_con_data_y_meta_de_paginacion', async () => {
    const respuesta = await request(app).get('/api/appointments?page=1&pageSize=10').set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual([FORMA_CITA]);
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 10, total: 1 });
  });

  test('responde_400_si_el_estado_no_es_valido', async () => {
    expect((await request(app).get('/api/appointments?status=OTRO').set(auth())).status).toBe(400);
  });
});

describe('GET /api/appointments/:id', () => {
  test('responde_200_con_la_cita_y_404_si_no_existe', async () => {
    const lista = await request(app).get('/api/appointments').set(auth());
    const respuesta = await request(app).get(`/api/appointments/${lista.body.data[0].id}`).set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual(FORMA_CITA);
    expect((await request(app).get('/api/appointments/987654').set(auth())).status).toBe(404);
  });
});

describe('PATCH /api/appointments/:id', () => {
  test('responde_200_con_la_cita_actualizada_y_400_si_no_hay_campos', async () => {
    const id = (await request(app).get('/api/appointments').set(auth())).body.data[0].id;
    const respuesta = await request(app).patch(`/api/appointments/${id}`).set(auth()).send({ reason: 'Motivo nuevo' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ ...FORMA_CITA, reason: 'Motivo nuevo' });
    expect((await request(app).patch(`/api/appointments/${id}`).set(auth()).send({})).status).toBe(400);
  });
});

describe('POST /api/appointments/:id/confirm y /cancel', () => {
  test('confirmar_responde_200_y_repetirlo_responde_409_APPOINTMENT_NOT_EDITABLE', async () => {
    const id = (await request(app).get('/api/appointments').set(auth())).body.data[0].id;
    const primera = await request(app).post(`/api/appointments/${id}/confirm`).set(auth());
    expect(primera.status).toBe(200);
    expect(primera.body.data.status).toBe('CONFIRMADA');
    const segunda = await request(app).post(`/api/appointments/${id}/confirm`).set(auth());
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('APPOINTMENT_NOT_EDITABLE');
  });

  test('cancelar_responde_200_con_la_cita_cancelada', async () => {
    const id = (await request(app).get('/api/appointments').set(auth())).body.data[0].id;
    const respuesta = await request(app).post(`/api/appointments/${id}/cancel`).set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ ...FORMA_CITA, status: 'CANCELADA', reason: 'Motivo nuevo' });
  });
});
