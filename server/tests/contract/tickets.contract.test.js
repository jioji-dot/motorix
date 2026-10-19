// Contrato de los endpoints de tickets (specs/004-pagos-tickets-dashboard/contracts/api.md).
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app.js';
import { env } from '../../config/env.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearOrdenCobrable, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const nuevaOrden = () => crearOrdenCobrable({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 500 });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo({ km: 52000 });
});

afterAll(cerrarConexiones);

describe('POST y GET /api/orders/:id/ticket', () => {
  test('POST_responde_201_con_la_forma_documentada_y_200_al_repetir', async () => {
    const orden = await nuevaOrden();
    const primera = await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    expect(primera.status).toBe(201);
    expect(primera.body.data).toEqual({
      id: expect.any(Number),
      folio: expect.stringMatching(/^TK-\d{6}$/),
      generatedAt: expect.any(String),
      workshop: { name: expect.any(String), address: expect.any(String), phone: expect.any(String) },
      order: { id: orden, folio: expect.stringMatching(/^OS-\d{6}$/), status: 'TERMINADO', deliveredAt: null },
      client: { name: expect.any(String), phone: expect.any(String) },
      vehicle: { description: 'Nissan Versa 2020', licensePlate: datos.licensePlate, mileage: 40000 },
      services: [{ description: 'Servicio de prueba', amount: '500.00' }],
      labor: [],
      parts: [],
      subtotal: '500.00',
      total: '500.00',
      payment: { methods: [], status: 'SIN_PAGOS', paid: '0.00', balance: '500.00' },
    });
    const segunda = await request(app).post(`/api/orders/${orden}/ticket`).set(como('ADMIN'));
    expect(segunda.status).toBe(200);
    expect(segunda.body.data.folio).toBe(primera.body.data.folio);
  });

  test('GET_responde_200_con_el_ticket_y_404_si_aun_no_se_genero', async () => {
    const orden = await nuevaOrden();
    const sinTicket = await request(app).get(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    expect(sinTicket.status).toBe(404);
    expect(sinTicket.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
    await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    const con = await request(app).get(`/api/orders/${orden}/ticket`).set(como('ADMIN'));
    expect(con.status).toBe(200);
    expect(con.body.data.order.id).toBe(orden);
    expect((await request(app).get('/api/orders/999999/ticket').set(como('ADMIN'))).status).toBe(404);
  });

  test('POST_responde_409_TICKET_NOT_AVAILABLE_si_la_orden_esta_en_curso_o_cancelada', async () => {
    for (const status of ['EN_REPARACION', 'CANCELADA']) {
      const orden = await crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status });
      const respuesta = await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('TICKET_NOT_AVAILABLE');
    }
  });

  test('responde_403_al_mecanico_y_401_sin_token', async () => {
    const orden = await nuevaOrden();
    for (const [metodo, ruta] of [['post', `/api/orders/${orden}/ticket`], ['get', `/api/orders/${orden}/ticket`], ['post', `/api/orders/${orden}/ticket/print-link`]]) {
      expect((await request(app)[metodo](ruta).set(como('MECHANIC'))).status).toBe(403);
      expect((await request(app)[metodo](ruta)).status).toBe(401);
    }
  });
});

describe('Impresión del ticket', () => {
  test('print_link_responde_200_con_la_direccion_y_la_vigencia_y_404_sin_ticket', async () => {
    const orden = await nuevaOrden();
    expect((await request(app).post(`/api/orders/${orden}/ticket/print-link`).set(como('RECEPTIONIST'))).status).toBe(404);
    await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    const respuesta = await request(app).post(`/api/orders/${orden}/ticket/print-link`).set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ url: expect.stringMatching(/\/api\/tickets\/print\/[\w-]+\.[\w-]+\.[\w-]+$/), expiresInSeconds: 300 });
  });

  test('la_pagina_publica_responde_text_html_con_el_ticket_sin_sesion', async () => {
    const orden = await nuevaOrden();
    await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    const { body } = await request(app).post(`/api/orders/${orden}/ticket/print-link`).set(como('RECEPTIONIST'));
    const ruta = new URL(body.data.url).pathname;
    const pagina = await request(app).get(ruta);
    expect(pagina.status).toBe(200);
    expect(pagina.headers['content-type']).toMatch(/text\/html/);
    expect(pagina.text).toContain('window.print()');
    expect(pagina.text).toContain('TK-');
  });

  test('responde_401_en_html_sencillo_con_token_alterado_vencido_o_de_sesion', async () => {
    const orden = await nuevaOrden();
    await request(app).post(`/api/orders/${orden}/ticket`).set(como('RECEPTIONIST'));
    const { body } = await request(app).post(`/api/orders/${orden}/ticket/print-link`).set(como('RECEPTIONIST'));
    const token = new URL(body.data.url).pathname.split('/').pop();
    const vencido = jwt.sign({ ord: orden, typ: 'ticket-print' }, `${env.jwt.secret}:ticket-print`, { expiresIn: -5 });
    for (const malo of [`${token}x`, vencido, usuarios.ADMIN.token, 'token-de-mas-de-diez-caracteres']) {
      const respuesta = await request(app).get(`/api/tickets/print/${malo}`);
      expect(respuesta.status).toBe(401);
      expect(respuesta.headers['content-type']).toMatch(/text\/html/);
      expect(respuesta.text).not.toContain('window.print()');
    }
    expect((await request(app).get('/api/tickets/print/corto')).status).toBe(400);
  });
});
