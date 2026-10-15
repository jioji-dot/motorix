// Pruebas de contrato del panel de control (ver specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAppointment,
  createAuthenticated,
  createClient,
  createOrder,
  createOrderService,
  createPart,
  createPayment,
  createVehicle,
  futureDateTime
} from '../helpers/factories.js';

const app = createApp();

let admin;
let recepcion;
let mecanico;

beforeEach(async () => {
  await cleanTables();
  admin = await createAuthenticated('ADMIN');
  recepcion = await createAuthenticated('RECEPTIONIST');
  mecanico = await createAuthenticated('MECHANIC');
});
afterAll(closePool);

const consultar = (auth) => {
  const peticion = request(app).get('/api/dashboard');
  return auth ? peticion.set('Authorization', auth) : peticion;
};

describe('contrato del panel de control', () => {
  test('test_el_administrador_recibe_la_forma_completa', async () => {
    const cliente = await createClient({ name: 'Ana Pérez' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'PRD482A' });
    await createAppointment(cliente.id, vehiculo.id, { scheduledAt: futureDateTime(1, 10), reason: 'Revisión de frenos' });
    await createPart({ code: 'DIS-DEL', name: 'Disco de freno delantero', stock: 0, minimumStock: 2 });
    const orden = await createOrder({ status: 'TERMINADO' });
    await createOrderService(orden.id, { amount: 800 });
    await createPayment(orden.id, { amount: 300 });

    const res = await consultar(admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      generatedAt: expect.any(String),
      orders: {
        received: expect.any(Number),
        diagnosis: expect.any(Number),
        inRepair: expect.any(Number),
        waitingPart: expect.any(Number),
        finishedNotDelivered: 1,
        deliveredToday: expect.any(Number)
      },
      appointments: {
        today: expect.any(Number),
        next7Days: 1,
        next: {
          id: expect.any(Number),
          scheduledAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
          clientName: 'Ana Pérez',
          vehiclePlate: 'PRD482A',
          reason: 'Revisión de frenos'
        }
      },
      maintenance: { overdue: 0, upcoming: 0, warningDays: 30, warningKm: 1000 },
      inventory: {
        low: 0,
        out: 1,
        critical: [
          {
            id: expect.any(Number),
            code: 'DIS-DEL',
            name: 'Disco de freno delantero',
            stock: 0,
            minimumStock: 2,
            stockStatus: 'OUT'
          }
        ]
      },
      payments: { collectedToday: 300, pendingBalance: 500, ordersToCollect: 1 }
    });
    expect(Number.isNaN(Date.parse(res.body.data.generatedAt))).toBe(false);
  });

  test('test_sin_datos_devuelve_ceros_next_nulo_y_critical_vacio', async () => {
    const res = await consultar(admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.data.appointments).toEqual({ today: 0, next7Days: 0, next: null });
    expect(res.body.data.inventory).toEqual({ low: 0, out: 0, critical: [] });
    expect(res.body.data.payments).toEqual({ collectedToday: 0, pendingBalance: 0, ordersToCollect: 0 });
  });

  test('test_recepcion_y_mecanico_reciben_403_y_sin_token_401', async () => {
    const a = await consultar(recepcion.auth);
    const b = await consultar(mecanico.auth);
    const c = await consultar(null);

    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
    expect(c.status).toBe(401);
    expect(a.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
    expect(JSON.stringify(a.body)).not.toMatch(/orders|payments|inventory/);
  });
});
