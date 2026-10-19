// Contrato de POST, PATCH y GET /api/maintenance (specs/003-.../contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearUsuariosDePrueba, fechaDia, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const cuerpo = (extra = {}) => ({
  vehicleId: datos.vehicleId,
  serviceType: 'Cambio de aceite',
  lastServiceDate: fechaDia(-10),
  lastMileage: 40000,
  nextDate: fechaDia(170),
  nextMileage: 45000,
  ...extra,
});

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo({ km: 40500 });
});

afterAll(cerrarConexiones);

describe('POST /api/maintenance', () => {
  test('responde_201_con_la_forma_documentada', async () => {
    const respuesta = await request(app).post('/api/maintenance').set(como('MECHANIC')).send(cuerpo());
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      id: expect.any(Number),
      vehicleId: datos.vehicleId,
      serviceType: 'Cambio de aceite',
      lastServiceDate: fechaDia(-10),
      lastMileage: 40000,
      nextDate: fechaDia(170),
      nextMileage: 45000,
      status: 'PENDIENTE',
      classification: 'NORMAL',
      daysLeft: 170,
      kmLeft: 4500,
      completedAt: null,
      vehicle: { id: datos.vehicleId, licensePlate: datos.licensePlate, currentMileage: 40500 },
      client: { id: datos.clientId, name: expect.any(String), phone: expect.any(String) },
    });
  });

  test('responde_400_con_el_campo_en_details', async () => {
    const respuesta = await request(app)
      .post('/api/maintenance')
      .set(como('ADMIN'))
      .send(cuerpo({ nextDate: undefined, nextMileage: undefined }));
    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: expect.any(String), details: [{ field: 'nextDate', message: expect.any(String) }] },
    });
  });

  test('responde_404_con_vehiculo_u_orden_inexistentes_y_403_a_recepcion', async () => {
    const sinVehiculo = await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo({ vehicleId: 999999 }));
    expect(sinVehiculo.status).toBe(404);
    const sinOrden = await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo({ sourceOrderId: 999999 }));
    expect(sinOrden.status).toBe(404);
    const recepcion = await request(app).post('/api/maintenance').set(como('RECEPTIONIST')).send(cuerpo());
    expect(recepcion.status).toBe(403);
    expect(recepcion.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET y PATCH /api/maintenance/:id', () => {
  let id;
  beforeAll(async () => {
    const otro = await crearClienteConVehiculo();
    const r = await request(app)
      .post('/api/maintenance')
      .set(como('ADMIN'))
      .send(cuerpo({ vehicleId: otro.vehicleId, serviceType: 'Frenos' }));
    id = r.body.data.id;
  });

  test('GET_responde_200_con_el_mantenimiento_y_404_si_no_existe', async () => {
    const ok = await request(app).get(`/api/maintenance/${id}`).set(como('RECEPTIONIST'));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ id, serviceType: 'Frenos', classification: expect.any(String) });
    const no = await request(app).get('/api/maintenance/999999').set(como('RECEPTIONIST'));
    expect(no.status).toBe(404);
    expect(no.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('PATCH_responde_200_actualizado_y_permite_quitar_un_valor_si_queda_otro', async () => {
    const ok = await request(app).patch(`/api/maintenance/${id}`).set(como('MECHANIC')).send({ nextDate: null, notes: 'Revisar balatas' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ nextDate: null, notes: 'Revisar balatas', daysLeft: null });
  });

  test('PATCH_responde_400_si_quedaria_sin_proxima_fecha_ni_kilometraje', async () => {
    const mal = await request(app).patch(`/api/maintenance/${id}`).set(como('MECHANIC')).send({ nextMileage: null });
    expect(mal.status).toBe(400);
    expect(mal.body.error.details[0].field).toBe('nextDate');
  });

  test('PATCH_responde_409_MAINTENANCE_NOT_EDITABLE_si_ya_esta_atendido', async () => {
    const r = await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo({ vehicleId: datos.vehicleId, serviceType: 'Frenos' }));
    const original = await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo({ vehicleId: datos.vehicleId, serviceType: 'Batería' }));
    await request(app).post('/api/maintenance').set(como('ADMIN')).send(cuerpo({ vehicleId: datos.vehicleId, serviceType: 'Batería' }));
    const respuesta = await request(app).patch(`/api/maintenance/${original.body.data.id}`).set(como('ADMIN')).send({ notes: 'x' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('MAINTENANCE_NOT_EDITABLE');
    expect(r.status).toBe(201);
  });
});
