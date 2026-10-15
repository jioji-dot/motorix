// Pruebas de contrato de GET /api/maintenance (ver specs/003-historial-inventario/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMaintenance,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato del listado de mantenimientos', () => {
  test('test_devuelve_data_con_la_forma_de_maintenance_y_meta_con_los_umbrales', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient({ name: 'Ana Pérez', phone: '5512345678' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'ABC123', currentMileage: 20000 });
    const m = await createMaintenance(vehiculo.id, { nextMileage: 19000, description: 'Cambio de aceite' });

    const res = await request(app).get('/api/maintenance').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: m.id,
        vehicleId: vehiculo.id,
        vehiclePlate: 'ABC123',
        vehicleTitle: expect.any(String),
        clientId: cliente.id,
        clientName: 'Ana Pérez',
        clientPhone: '5512345678',
        orderId: m.orderId,
        orderFolio: expect.stringMatching(/^OS-\d{6}$/),
        description: 'Cambio de aceite',
        nextDate: null,
        nextMileage: 19000,
        currentMileage: 20000,
        status: 'PENDIENTE',
        classification: 'OVERDUE',
        daysRemaining: null,
        kmRemaining: -1000,
        completedAt: null,
        createdAt: expect.any(String),
        canManage: false
      }
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1, warningDays: 30, warningKm: 1000 });
  });

  test('test_los_parametros_invalidos_responden_400_validation_error', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    const res = await request(app).get('/api/maintenance?classification=NADA').set('Authorization', auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('classification');
  });

  test('test_un_mecanico_recibe_403', async () => {
    const { auth } = await createAuthenticated('MECHANIC');

    const res = await request(app).get('/api/maintenance').set('Authorization', auth);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
