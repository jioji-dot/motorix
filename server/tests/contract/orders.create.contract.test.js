// Contrato de POST /api/orders y GET /api/mechanics (specs/002-citas-ordenes-servicio/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const auth = () => ({ Authorization: `Bearer ${usuarios.RECEPTIONIST.token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo({ km: 1000 });
});

afterAll(cerrarConexiones);

const NUEVA = () => ({
  clientId: datos.clientId,
  vehicleId: datos.vehicleId,
  mechanicId: usuarios.MECHANIC.id,
  entryMileage: 2000,
  reportedProblem: 'Falla al arrancar',
});

describe('POST /api/orders', () => {
  test('responde_201_con_la_orden_completa_y_su_folio', async () => {
    const respuesta = await request(app).post('/api/orders').set(auth()).send(NUEVA());
    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      data: {
        id: expect.any(Number),
        folio: expect.stringMatching(/^OS-\d{6}$/),
        status: 'RECIBIDO',
        appointmentId: null,
        clientId: datos.clientId,
        vehicleId: datos.vehicleId,
        mechanicId: usuarios.MECHANIC.id,
        entryMileage: 2000,
        reportedProblem: 'Falla al arrancar',
        diagnosis: null,
        notes: null,
        recommendations: null,
        cancellationReason: null,
        deliveredAt: null,
        total: '0.00',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        client: { id: datos.clientId, name: expect.any(String) },
        vehicle: { id: datos.vehicleId, brand: 'Nissan', model: 'Versa', year: 2020, licensePlate: datos.licensePlate },
        mechanic: { id: usuarios.MECHANIC.id, name: 'Mecánico de prueba' },
        services: [],
        labor: [],
        history: [
          {
            fromStatus: null,
            toStatus: 'RECIBIDO',
            changedBy: { id: usuarios.RECEPTIONIST.id, name: 'Recepción de prueba' },
            reason: null,
            changedAt: expect.any(String),
          },
        ],
        allowedTransitions: expect.any(Array),
      },
    });
  });

  test('responde_400_con_detalles_por_campo', async () => {
    const respuesta = await request(app).post('/api/orders').set(auth()).send({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['clientId', 'vehicleId', 'mechanicId', 'entryMileage']),
    );
  });

  test('responde_400_si_solo_falta_el_problema_reportado_y_no_hay_cita', async () => {
    const respuesta = await request(app)
      .post('/api/orders')
      .set(auth())
      .send({ ...NUEVA(), reportedProblem: undefined });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual([{ field: 'reportedProblem', message: 'El problema reportado es obligatorio.' }]);
  });

  test('responde_404_con_error_estandar_si_el_vehiculo_no_existe', async () => {
    const respuesta = await request(app).post('/api/orders').set(auth()).send({ ...NUEVA(), vehicleId: 987654 });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('responde_409_MILEAGE_DECREASE_con_error_estandar', async () => {
    const respuesta = await request(app).post('/api/orders').set(auth()).send({ ...NUEVA(), entryMileage: 100 });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: { code: 'MILEAGE_DECREASE', message: expect.any(String) } });
  });
});

describe('GET /api/mechanics', () => {
  test('responde_200_con_id_y_nombre_de_los_mecanicos_activos', async () => {
    const respuesta = await request(app).get('/api/mechanics').set(auth());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: [{ id: usuarios.MECHANIC.id, name: 'Mecánico de prueba' }] });
  });
});
