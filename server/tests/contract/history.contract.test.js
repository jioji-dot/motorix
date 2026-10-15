// Pruebas de contrato de GET /api/vehicles/:id/history
// (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMechanic,
  createOrder,
  createOrderLabor,
  createOrderPart,
  createOrderService,
  createPart,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const FORMA_ENTRADA = {
  orderId: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{6}$/),
  status: expect.stringMatching(/^(TERMINADO|ENTREGADO)$/),
  serviceDate: expect.any(String),
  mileage: expect.any(Number),
  mechanicName: expect.any(String),
  reportedProblem: expect.any(String),
  diagnosis: null,
  recommendations: null,
  services: expect.any(Array),
  labor: expect.any(Array),
  parts: expect.any(Array),
  total: expect.any(Number)
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato del historial del vehículo', () => {
  test('test_devuelve_data_y_meta_con_la_forma_del_contrato', async () => {
    const { auth } = await createAuthenticated('MECHANIC');
    const mecanico = await createMechanic({ name: 'Mario Mecánico' });
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const orden = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.id,
      status: 'ENTREGADO',
      entryMileage: 20000
    });
    await createOrderService(orden.id, { description: 'Cambio de aceite', amount: 850 });
    await createOrderLabor(orden.id, { description: 'Servicio completo', hours: 2, hourlyRate: 300 });
    const pieza = await createPart({ code: 'FIL-01', name: 'Filtro de aceite' });
    await createOrderPart(orden.id, pieza.id, { quantity: 1, unitPrice: 120 });

    const res = await request(app).get(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        ...FORMA_ENTRADA,
        orderId: orden.id,
        folio: orden.folio,
        status: 'ENTREGADO',
        mileage: 20000,
        mechanicName: 'Mario Mecánico',
        services: [{ description: 'Cambio de aceite', amount: 850 }],
        labor: [{ description: 'Servicio completo', hours: 2, hourlyRate: 300, amount: 600 }],
        parts: [{ code: 'FIL-01', name: 'Filtro de aceite', quantity: 1, unitPrice: 120, amount: 120 }],
        total: 1570
      }
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_un_vehiculo_sin_servicios_devuelve_una_lista_vacia', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    const res = await request(app).get(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  });

  test('test_un_vehiculo_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/vehicles/9999/history').set('Authorization', auth);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
