// Contrato de GET /api/vehicles/:id/history y del campo serviceMileage (specs/003-.../contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
  await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status: 'TERMINADO' });
});

afterAll(cerrarConexiones);

describe('GET /api/vehicles/:id/history', () => {
  test('responde_200_con_la_forma_documentada_de_cada_entrada', async () => {
    const respuesta = await request(app).get(`/api/vehicles/${datos.vehicleId}/history`).set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect(respuesta.body.data[0]).toMatchObject({
      orderId: expect.any(Number),
      folio: expect.stringMatching(/^OS-\d{6}$/),
      status: 'TERMINADO',
      mileage: 40000,
      mechanic: { id: usuarios.MECHANIC.id, name: expect.any(String) },
      services: [],
      labor: [],
      parts: [],
    });
    expect(respuesta.body.data[0]).toHaveProperty('serviceDate');
    expect(respuesta.body.data[0]).toHaveProperty('recommendations');
  });

  test('responde_404_con_error_estandar_si_el_vehiculo_no_existe', async () => {
    const respuesta = await request(app).get('/api/vehicles/999999/history').set(como('ADMIN'));
    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  test('responde_400_con_paginacion_invalida_y_401_sin_token', async () => {
    const mala = await request(app).get(`/api/vehicles/${datos.vehicleId}/history?page=0`).set(como('ADMIN'));
    expect(mala.status).toBe(400);
    const sin = await request(app).get(`/api/vehicles/${datos.vehicleId}/history`);
    expect(sin.status).toBe(401);
  });
});

describe('PATCH /api/orders/:id con serviceMileage', () => {
  test('responde_200_con_serviceMileage_y_400_con_el_campo_si_es_menor_al_de_entrada', async () => {
    const id = await crearOrden({
      ...datos,
      mechanicId: usuarios.MECHANIC.id,
      createdBy: usuarios.RECEPTIONIST.id,
      status: 'EN_REPARACION',
    });
    const ok = await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ serviceMileage: 40300 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.serviceMileage).toBe(40300);
    const mal = await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ serviceMileage: 100 });
    expect(mal.status).toBe(400);
    expect(mal.body.error.details[0].field).toBe('serviceMileage');
  });
});
