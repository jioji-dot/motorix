// Pruebas de contrato de tickets (ver specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createOrder,
  createOrderLabor,
  createOrderPart,
  createOrderService,
  createPart,
  createPayment,
  createTicket,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const FORMA_RESUMEN = {
  total: expect.any(Number),
  paid: expect.any(Number),
  pending: expect.any(Number),
  balance: expect.any(Number),
  available: expect.any(Number),
  status: expect.stringMatching(/^(NO_CHARGE|UNPAID|PARTIAL|PAID)$/)
};

let recepcion;
let orden;

beforeEach(async () => {
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  const cliente = await createClient({ name: 'Ana Pérez', phone: '5511223344' });
  const vehiculo = await createVehicle(cliente.id, { brand: 'Nissan', model: 'Versa', licensePlate: 'PRD482A' });
  orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, status: 'TERMINADO', entryMileage: 47000 });
  await createOrderService(orden.id, { description: 'Afinación', amount: 450 });
  await createOrderLabor(orden.id, { description: 'Cambio de bujías', hours: 2.5, hourlyRate: 350 });
  const refaccion = await createPart({ code: 'BUJ-NGK', name: 'Bujía de iridio', stock: 20 });
  await createOrderPart(orden.id, refaccion.id, { quantity: 4, unitPrice: 95 });
  await createPayment(orden.id, { method: 'CARD', amount: 1000, reference: 'AUT-4521' });
});
afterAll(closePool);

const FORMA_TICKET = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^TK-\d{6}$/),
  issuedAt: expect.any(String),
  generatedByName: expect.any(String),
  workshop: { name: expect.any(String), address: expect.any(String), phone: expect.any(String) },
  order: {
    id: expect.any(Number),
    folio: expect.stringMatching(/^OS-\d{6}$/),
    status: expect.stringMatching(/^(TERMINADO|ENTREGADO)$/),
    createdAt: expect.any(String),
    deliveredAt: null
  },
  client: { name: expect.any(String), phone: expect.any(String) },
  vehicle: {
    brand: expect.any(String),
    model: expect.any(String),
    licensePlate: expect.any(String),
    entryMileage: expect.any(Number),
    serviceMileage: null
  },
  services: [{ description: expect.any(String), amount: expect.any(Number) }],
  labor: [
    { description: expect.any(String), hours: expect.any(Number), hourlyRate: expect.any(Number), amount: expect.any(Number) }
  ],
  parts: [
    {
      code: expect.any(String),
      name: expect.any(String),
      quantity: expect.any(Number),
      unitPrice: expect.any(Number),
      amount: expect.any(Number)
    }
  ],
  subtotals: { services: expect.any(Number), labor: expect.any(Number), parts: expect.any(Number) },
  total: expect.any(Number),
  payments: [
    {
      method: expect.any(String),
      amount: expect.any(Number),
      status: expect.any(String),
      reference: expect.any(String),
      createdAt: expect.any(String)
    }
  ],
  summary: FORMA_RESUMEN
};

describe('contrato de tickets', () => {
  test('test_generar_responde_201_con_el_ticket_completo', async () => {
    const res = await request(app).post(`/api/orders/${orden.id}/ticket`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(FORMA_TICKET);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        generatedByName: recepcion.user.name,
        client: { name: 'Ana Pérez', phone: '5511223344' },
        subtotals: { services: 450, labor: 875, parts: 380 },
        total: 1705
      })
    );
    expect(res.body.data.payments[0]).toEqual(expect.objectContaining({ method: 'CARD', amount: 1000, reference: 'AUT-4521' }));
    expect(res.body.data.summary).toEqual({ ...FORMA_RESUMEN, total: 1705, paid: 1000, balance: 705, status: 'PARTIAL' });
  });

  test('test_generar_de_nuevo_responde_200_con_el_mismo_ticket', async () => {
    const primero = await request(app).post(`/api/orders/${orden.id}/ticket`).set('Authorization', recepcion.auth);
    const segundo = await request(app).post(`/api/orders/${orden.id}/ticket`).set('Authorization', recepcion.auth);

    expect(primero.status).toBe(201);
    expect(segundo.status).toBe(200);
    expect(segundo.body.data.id).toBe(primero.body.data.id);
    expect(segundo.body.data.folio).toBe(primero.body.data.folio);
  });

  test('test_consultar_por_id_responde_200_con_el_ticket', async () => {
    const ticket = await createTicket(orden.id);

    const res = await request(app).get(`/api/tickets/${ticket.id}`).set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(FORMA_TICKET);
    expect(res.body.data.folio).toBe(ticket.folio);
  });

  test('test_el_listado_devuelve_data_con_la_forma_resumida_y_meta', async () => {
    const ticket = await createTicket(orden.id);

    const res = await request(app).get('/api/tickets').set('Authorization', recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id: ticket.id,
        folio: ticket.folio,
        issuedAt: expect.any(String),
        orderId: orden.id,
        orderFolio: orden.folio,
        clientName: 'Ana Pérez',
        vehiclePlate: 'PRD482A',
        total: 1705,
        paymentStatus: 'PARTIAL'
      }
    ]);
    expect(res.body.meta).toEqual(expect.objectContaining({ page: 1, pageSize: 20, total: 1 }));
  });

  test('test_los_errores_usan_el_formato_estandar', async () => {
    const enReparacion = await createOrder({ status: 'EN_REPARACION' });

    const noListo = await request(app).post(`/api/orders/${enReparacion.id}/ticket`).set('Authorization', recepcion.auth);
    const inexistente = await request(app).get('/api/tickets/999999').set('Authorization', recepcion.auth);
    const sinToken = await request(app).get('/api/tickets');

    expect(noListo.status).toBe(409);
    expect(noListo.body.error).toEqual(expect.objectContaining({ code: 'TICKET_ORDER_NOT_READY', message: expect.any(String) }));
    expect(inexistente.status).toBe(404);
    expect(sinToken.status).toBe(401);
  });
});
