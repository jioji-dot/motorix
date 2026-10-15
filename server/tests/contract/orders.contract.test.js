// Pruebas de contrato de /api/orders (ver specs/002-citas-ordenes-servicio/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMechanic,
  createOrder,
  createOrderLabor,
  createOrderService,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const FORMA_RESUMEN = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{6}$/),
  clientId: expect.any(Number),
  clientName: expect.any(String),
  vehicleId: expect.any(Number),
  vehiclePlate: expect.any(String),
  vehicleTitle: expect.any(String),
  mechanicId: null,
  mechanicName: null,
  entryMileage: expect.any(Number),
  reportedProblem: expect.any(String),
  status: 'RECIBIDO',
  appointmentId: null,
  total: expect.any(Number),
  paymentStatus: expect.stringMatching(/^(NO_CHARGE|UNPAID|PARTIAL|PAID)$/),
  createdAt: expect.any(String),
  updatedAt: expect.any(String)
};

const FORMA_DETALLE = {
  ...FORMA_RESUMEN,
  diagnosis: null,
  notes: null,
  recommendations: null,
  deliveredAt: null,
  services: expect.any(Array),
  labor: expect.any(Array),
  servicesSubtotal: expect.any(Number),
  laborSubtotal: expect.any(Number),
  parts: expect.any(Array),
  partsSubtotal: expect.any(Number),
  serviceMileage: null,
  payment: expect.objectContaining({ status: expect.any(String) }),
  ticketId: null,
  statusHistory: expect.any(Array),
  allowedTransitions: expect.any(Array),
  editable: {
    work: expect.any(Boolean),
    notesAndRecommendations: expect.any(Boolean),
    parts: expect.any(Boolean),
    basicData: expect.any(Boolean)
  }
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato de órdenes', () => {
  test('test_el_alta_responde_201_con_el_detalle_completo_de_la_orden', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    const res = await request(app).post('/api/orders').set('Authorization', auth).send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      entryMileage: 12000,
      reportedProblem: 'Ruido al frenar'
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ ...FORMA_DETALLE, entryMileage: 12000, reportedProblem: 'Ruido al frenar' })
    );
    expect(res.body.data.statusHistory).toEqual([
      {
        fromStatus: null,
        toStatus: 'RECIBIDO',
        changedBy: { id: expect.any(Number), name: expect.any(String) },
        createdAt: expect.any(String)
      }
    ]);
    expect(res.body.data.total).toBe(0);
  });

  test('test_el_detalle_incluye_servicios_mano_de_obra_y_totales', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const mecanico = await createMechanic({ name: 'Mario Mecánico' });
    const orden = await createOrder({ mechanicId: mecanico.id, status: 'EN_REPARACION' });
    await createOrderService(orden.id, { description: 'Cambio de balatas', amount: 850.5 });
    await createOrderLabor(orden.id, { description: 'Montaje', hours: 2, hourlyRate: 150 });

    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        mechanicName: 'Mario Mecánico',
        services: [{ id: expect.any(Number), description: 'Cambio de balatas', amount: 850.5 }],
        labor: [{ id: expect.any(Number), description: 'Montaje', hours: 2, hourlyRate: 150, amount: 300 }],
        servicesSubtotal: 850.5,
        laborSubtotal: 300,
        total: 1150.5
      })
    );
  });

  test('test_el_listado_devuelve_resumenes_y_meta', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    await createOrder();

    const res = await request(app).get('/api/orders').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining(FORMA_RESUMEN)]);
    expect(res.body.data[0]).not.toHaveProperty('services');
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
  });

  test('test_los_errores_usan_el_formato_del_contrato', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');

    const invalido = await request(app).post('/api/orders').set('Authorization', auth).send({});
    const inexistente = await request(app).get('/api/orders/9999').set('Authorization', auth);

    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalido.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['entryMileage'])
    );
    expect(inexistente.status).toBe(404);
    expect(inexistente.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });
});
