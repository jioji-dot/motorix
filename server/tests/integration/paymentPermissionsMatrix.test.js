// Matriz de permisos del Sprint 4 por rol y por endpoint (ver specs/004-pagos-tickets-dashboard/contracts/api.md).
// Cada fila: [descripción, función que arma la petición, estado esperado de administración, de recepción y
// del mecánico]. Sin token todas responden 401.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createOrder,
  createOrderService,
  createPayment,
  createTicket
} from '../helpers/factories.js';
import * as stub from '../helpers/mercadoPagoStub.js';

const app = createApp();

let usuarios;
let ctx;

beforeAll(stub.start);
afterAll(async () => {
  await stub.stop();
  await closePool();
});

/** Datos frescos para cada petición: una orden cobrable, un pago aprobado, un cobro pendiente y un ticket. */
async function prepararContexto() {
  const orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
  const aprobado = await createPayment(orden.id, { amount: 100 });
  const pendiente = await createPayment(orden.id, { method: 'MERCADO_PAGO', amount: 200, status: 'PENDIENTE' });
  const ordenSinTicket = await createOrder({ status: 'ENTREGADO' });
  await createOrderService(ordenSinTicket.id, { amount: 300 });
  const ordenConTicket = await createOrder({ status: 'ENTREGADO' });
  await createOrderService(ordenConTicket.id, { amount: 300 });
  const ticket = await createTicket(ordenConTicket.id);
  return { orden, aprobado, pendiente, ordenSinTicket, ticket };
}

const PETICIONES = [
  ['GET /api/orders/:id/payments', (c) => ['get', `/api/orders/${c.orden.id}/payments`], 200, 200, 403],
  [
    'POST /api/orders/:id/payments',
    (c) => ['post', `/api/orders/${c.orden.id}/payments`, { method: 'CASH', amount: 50 }],
    201,
    201,
    403
  ],
  [
    'POST /api/orders/:id/payments/mercado-pago',
    (c) => ['post', `/api/orders/${c.ordenSinTicket.id}/payments/mercado-pago`, { amount: 100 }],
    201,
    201,
    403
  ],
  ['GET /api/payments', () => ['get', '/api/payments'], 200, 200, 403],
  ['GET /api/payments/:id', (c) => ['get', `/api/payments/${c.aprobado.id}`], 200, 200, 403],
  ['GET /api/payments/:id inexistente', () => ['get', '/api/payments/999999'], 404, 404, 403],
  ['POST /api/payments/:id/refresh', (c) => ['post', `/api/payments/${c.pendiente.id}/refresh`], 200, 200, 403],
  ['POST /api/payments/:id/cancel', (c) => ['post', `/api/payments/${c.pendiente.id}/cancel`], 200, 200, 403],
  [
    'POST /api/payments/:id/void',
    (c) => ['post', `/api/payments/${c.aprobado.id}/void`, { reason: 'Prueba de permisos' }],
    200,
    403,
    403
  ],
  ['POST /api/orders/:id/ticket', (c) => ['post', `/api/orders/${c.ordenSinTicket.id}/ticket`], 201, 201, 403],
  ['GET /api/tickets', () => ['get', '/api/tickets'], 200, 200, 403],
  ['GET /api/tickets/:id', (c) => ['get', `/api/tickets/${c.ticket.id}`], 200, 200, 403],
  ['GET /api/tickets/:id inexistente', () => ['get', '/api/tickets/999999'], 404, 404, 403],
  ['GET /api/dashboard', () => ['get', '/api/dashboard'], 200, 403, 403]
];

beforeEach(async () => {
  stub.reset();
  process.env.MP_ACCESS_TOKEN = stub.STUB_TOKEN;
  await cleanTables();
  usuarios = {
    admin: await createAuthenticated('ADMIN'),
    recepcion: await createAuthenticated('RECEPTIONIST'),
    mecanico: await createAuthenticated('MECHANIC')
  };
  ctx = await prepararContexto();
});

async function ejecutar(descripcion, armar, auth) {
  const [metodo, ruta, cuerpo] = armar(ctx);
  let peticion = request(app)[metodo](ruta);
  if (auth) peticion = peticion.set('Authorization', auth);
  return cuerpo ? peticion.send(cuerpo) : peticion;
}

describe('matriz de permisos por rol', () => {
  test.each(PETICIONES)('test_%s', async (descripcion, armar, admin, recepcion, mecanico) => {
    const resultados = {
      admin: (await ejecutar(descripcion, armar, usuarios.admin.auth)).status
    };
    // Cada rol usa un contexto limpio para que los cambios de uno no afecten al siguiente.
    await cleanTables();
    usuarios.recepcion = await createAuthenticated('RECEPTIONIST');
    ctx = await prepararContexto();
    resultados.recepcion = (await ejecutar(descripcion, armar, usuarios.recepcion.auth)).status;

    await cleanTables();
    usuarios.mecanico = await createAuthenticated('MECHANIC');
    ctx = await prepararContexto();
    resultados.mecanico = (await ejecutar(descripcion, armar, usuarios.mecanico.auth)).status;
    const sinToken = (await ejecutar(descripcion, armar, null)).status;

    expect(resultados).toEqual({ admin, recepcion, mecanico });
    expect(sinToken).toBe(401);
  });
});

describe('datos de pago ocultos para el mecánico', () => {
  test('test_el_mecanico_recibe_payment_payment_status_y_ticket_id_en_null', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const mia = await createOrder({ status: 'TERMINADO', mechanicId: mecanico.user.id });
    await createOrderService(mia.id, { amount: 500 });
    await createPayment(mia.id, { amount: 200 });
    await createTicket(mia.id);

    const detalle = await request(app).get(`/api/orders/${mia.id}`).set('Authorization', mecanico.auth);
    const listado = await request(app).get('/api/orders').set('Authorization', mecanico.auth);

    expect(detalle.status).toBe(200);
    expect(detalle.body.data).toEqual(expect.objectContaining({ payment: null, paymentStatus: null, ticketId: null }));
    expect(listado.body.data[0]).toEqual(expect.objectContaining({ paymentStatus: null }));
    expect(JSON.stringify(detalle.body)).not.toMatch(/"balance"|"paid"|TK-/);
  });

  test('test_administracion_y_recepcion_si_reciben_el_resumen_de_pago', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });
    await createOrderService(orden.id, { amount: 500 });
    await createPayment(orden.id, { amount: 200 });

    for (const rol of ['admin', 'recepcion']) {
      const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', usuarios[rol].auth);
      expect(res.body.data.payment).toEqual(expect.objectContaining({ total: 500, paid: 200, balance: 300 }));
      expect(res.body.data.paymentStatus).toBe('PARTIAL');
    }
  });

  test('test_solo_administracion_puede_anular_y_el_pago_sigue_aprobado_si_recepcion_lo_intenta', async () => {
    const res = await request(app)
      .post(`/api/payments/${ctx.aprobado.id}/void`)
      .set('Authorization', usuarios.recepcion.auth)
      .send({ reason: 'No debería poder' });

    expect(res.status).toBe(403);
    const estado = await request(app).get(`/api/payments/${ctx.aprobado.id}`).set('Authorization', usuarios.admin.auth);
    expect(estado.body.data.status).toBe('APROBADO');
  });
});
