// Pruebas de integración de tickets de servicio (US4) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { DEFAULT_WORKSHOP } from '../../config/constants.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createOrder,
  createOrderService,
  createPayment,
  createTicket,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const generar = (auth, orderId) => request(app).post(`/api/orders/${orderId}/ticket`).set('Authorization', auth);
const consultar = (auth, id) => request(app).get(`/api/tickets/${id}`).set('Authorization', auth);

let recepcion;
let admin;
let mecanico;
let orden;

beforeEach(async () => {
  await cleanTables();
  recepcion = await createAuthenticated('RECEPTIONIST');
  admin = await createAuthenticated('ADMIN');
  mecanico = await createAuthenticated('MECHANIC');
  orden = await createOrder({ status: 'TERMINADO' });
  await createOrderService(orden.id, { amount: 1000 });
});

/** `app_settings` es compartida: se dejan los valores iniciales de la migración 004 para otras pruebas. */
async function restaurarTaller() {
  await pool.query("DELETE FROM app_settings WHERE setting_key LIKE 'workshop_%'");
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES
       ('workshop_name', ?), ('workshop_address', ?), ('workshop_phone', ?)`,
    [DEFAULT_WORKSHOP.name, DEFAULT_WORKSHOP.address, DEFAULT_WORKSHOP.phone]
  );
}

afterAll(async () => {
  await restaurarTaller();
  await closePool();
});

describe('generación del ticket', () => {
  test.each(['TERMINADO', 'ENTREGADO'])('test_se_genera_para_una_orden_%s', async (status) => {
    const o = await createOrder({ status });
    await createOrderService(o.id, { amount: 300 });

    const res = await generar(recepcion.auth, o.id);

    expect(res.status).toBe(201);
    expect(res.body.data.order.status).toBe(status);
  });

  test.each(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'])(
    'test_se_rechaza_para_una_orden_%s',
    async (status) => {
      const o = await createOrder({ status });

      const res = await generar(recepcion.auth, o.id);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TICKET_ORDER_NOT_READY');
      expect((await pool.query('SELECT COUNT(*) AS n FROM tickets'))[0][0].n).toBe(0);
    }
  );

  test('test_regenerar_devuelve_el_mismo_id_y_folio_sin_crear_otro_registro', async () => {
    const a = await generar(recepcion.auth, orden.id);
    const b = await generar(admin.auth, orden.id);

    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.data.id).toBe(a.body.data.id);
    expect(b.body.data.folio).toBe(a.body.data.folio);
    expect(a.body.data.folio).toBe(`TK-${String(a.body.data.id).padStart(6, '0')}`);
    expect((await pool.query('SELECT COUNT(*) AS n FROM tickets'))[0][0].n).toBe(1);
  });

  test('test_dos_solicitudes_simultaneas_crean_un_solo_ticket', async () => {
    const respuestas = await Promise.all([generar(recepcion.auth, orden.id), generar(admin.auth, orden.id)]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(respuestas[0].body.data.id).toBe(respuestas[1].body.data.id);
    expect((await pool.query('SELECT COUNT(*) AS n FROM tickets'))[0][0].n).toBe(1);
  });

  test('test_guarda_quien_lo_genero', async () => {
    const res = await generar(recepcion.auth, orden.id);
    const [filas] = await pool.query('SELECT generated_by FROM tickets WHERE id = ?', [res.body.data.id]);

    expect(filas[0].generated_by).toBe(recepcion.user.id);
    expect(res.body.data.generatedByName).toBe(recepcion.user.name);
  });
});

describe('contenido del ticket', () => {
  test('test_coincide_con_la_orden_el_cliente_el_vehiculo_y_sus_lineas', async () => {
    const cliente = await createClient({ name: 'Luis Gómez', phone: '5599887766' });
    const vehiculo = await createVehicle(cliente.id, { brand: 'Chevrolet', model: 'Aveo', licensePlate: 'XYZ789' });
    const o = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, status: 'ENTREGADO', entryMileage: 31000 });
    await createOrderService(o.id, { description: 'Alineación', amount: 380 });

    const res = await generar(recepcion.auth, o.id);

    expect(res.body.data.order.folio).toBe(o.folio);
    expect(res.body.data.client).toEqual({ name: 'Luis Gómez', phone: '5599887766' });
    expect(res.body.data.vehicle).toEqual(
      expect.objectContaining({ brand: 'Chevrolet', model: 'Aveo', licensePlate: 'XYZ789', entryMileage: 31000 })
    );
    expect(res.body.data.services).toEqual([{ description: 'Alineación', amount: 380 }]);
    expect(res.body.data.total).toBe(380);
  });

  test('test_el_estado_de_pago_cambia_con_los_pagos_pero_el_contenido_de_la_orden_no', async () => {
    const creado = await generar(recepcion.auth, orden.id);
    expect(creado.body.data.summary.status).toBe('UNPAID');

    const parcial = await createPayment(orden.id, { amount: 400 });
    const tras1 = await consultar(recepcion.auth, creado.body.data.id);
    expect(tras1.body.data.summary).toEqual(expect.objectContaining({ paid: 400, balance: 600, status: 'PARTIAL' }));
    expect(tras1.body.data.payments).toHaveLength(1);

    await createPayment(orden.id, { amount: 600 });
    const tras2 = await consultar(recepcion.auth, creado.body.data.id);
    expect(tras2.body.data.summary.status).toBe('PAID');

    await pool.query("UPDATE payments SET status = 'ANULADO', void_reason = 'Error', voided_by = ?, voided_at = NOW() WHERE id = ?", [
      admin.user.id,
      parcial.id
    ]);
    const tras3 = await consultar(recepcion.auth, creado.body.data.id);
    expect(tras3.body.data.summary).toEqual(expect.objectContaining({ paid: 600, balance: 400, status: 'PARTIAL' }));
    expect(tras3.body.data.payments).toHaveLength(1);

    expect(tras3.body.data.folio).toBe(creado.body.data.folio);
    expect(tras3.body.data.services).toEqual(creado.body.data.services);
    expect(tras3.body.data.total).toBe(creado.body.data.total);
  });

  test('test_los_datos_del_taller_salen_de_app_settings', async () => {
    await pool.query("DELETE FROM app_settings WHERE setting_key LIKE 'workshop_%'");
    await pool.query(
      "INSERT INTO app_settings (setting_key, setting_value) VALUES ('workshop_name', 'Taller Los Pinos'), ('workshop_address', 'Calle 5 #20'), ('workshop_phone', '5544332211')"
    );

    const res = await generar(recepcion.auth, orden.id);

    expect(res.body.data.workshop).toEqual({ name: 'Taller Los Pinos', address: 'Calle 5 #20', phone: '5544332211' });
  });

  test('test_usa_los_datos_predeterminados_si_faltan_las_claves_del_taller', async () => {
    await pool.query("DELETE FROM app_settings WHERE setting_key LIKE 'workshop_%'");

    const res = await generar(recepcion.auth, orden.id);

    expect(res.body.data.workshop).toEqual({
      name: 'Motorix Taller Mecánico',
      address: 'Av. Principal 123, Ciudad de México',
      phone: '5555123456'
    });
  });
});

describe('listado y permisos', () => {
  test('test_el_listado_busca_por_folio_del_ticket_de_la_orden_cliente_y_placa', async () => {
    const cliente = await createClient({ name: 'Marta Ruiz' });
    const vehiculo = await createVehicle(cliente.id, { licensePlate: 'MRT555' });
    const otra = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id, status: 'ENTREGADO' });
    await createOrderService(otra.id, { amount: 200 });
    const t1 = await createTicket(orden.id);
    const t2 = await createTicket(otra.id);

    const buscar = async (search) =>
      (await request(app).get('/api/tickets').query({ search }).set('Authorization', recepcion.auth)).body.data.map((t) => t.id);

    expect(await buscar(t2.folio)).toEqual([t2.id]);
    expect(await buscar(otra.folio)).toEqual([t2.id]);
    expect(await buscar('Marta')).toEqual([t2.id]);
    expect(await buscar('MRT555')).toEqual([t2.id]);
    expect(await buscar('')).toEqual(expect.arrayContaining([t1.id, t2.id]));
  });

  test('test_el_listado_pagina_los_resultados', async () => {
    for (let i = 0; i < 3; i += 1) {
      const o = await createOrder({ status: 'TERMINADO' });
      await createTicket(o.id);
    }

    const res = await request(app).get('/api/tickets').query({ pageSize: 2, page: 2 }).set('Authorization', admin.auth);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  test('test_el_mecanico_no_accede_a_los_tickets', async () => {
    const ticket = await createTicket(orden.id);

    expect((await generar(mecanico.auth, orden.id)).status).toBe(403);
    expect((await consultar(mecanico.auth, ticket.id)).status).toBe(403);
    expect((await request(app).get('/api/tickets').set('Authorization', mecanico.auth)).status).toBe(403);
  });

  test('test_sin_token_responde_401_y_un_ticket_inexistente_404', async () => {
    expect((await request(app).post(`/api/orders/${orden.id}/ticket`)).status).toBe(401);
    expect((await consultar(recepcion.auth, 999999)).status).toBe(404);
  });

  test('test_generar_el_ticket_de_una_orden_inexistente_responde_404', async () => {
    expect((await generar(recepcion.auth, 999999)).status).toBe(404);
  });
});
