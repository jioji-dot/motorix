// Pruebas de integración de los datos de ejemplo del Sprint 4 (pagos y tickets) sobre `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { openConnection } from '../../scripts/migrate.js';
import { runSeeds } from '../../scripts/seed.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';

const app = createApp();
let conexion;

const contar = async (tabla, condicion = '1 = 1') => {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla} WHERE ${condicion}`);
  return Number(total);
};

const iniciarSesion = async (identifier, password) => {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  return `Bearer ${res.body.data.token}`;
};

beforeAll(async () => {
  conexion = await openConnection();
});

beforeEach(async () => {
  await cleanTables();
  await runSeeds(conexion);
});

afterAll(async () => {
  await conexion.end();
  await closePool();
});

describe('pagos de ejemplo', () => {
  test('test_hay_ocho_pagos_repartidos_por_metodo_y_estado', async () => {
    expect(await contar('payments')).toBe(8);

    const [filas] = await pool.query('SELECT method, status, COUNT(*) AS total FROM payments GROUP BY method, status');
    const mapa = Object.fromEntries(filas.map((f) => [`${f.method}/${f.status}`, Number(f.total)]));
    expect(mapa).toEqual({
      'CASH/APROBADO': 2,
      'CASH/ANULADO': 1,
      'CARD/APROBADO': 1,
      'TRANSFER/APROBADO': 1,
      'MERCADO_PAGO/APROBADO': 1,
      'MERCADO_PAGO/PENDIENTE': 1,
      'MERCADO_PAGO/CANCELADO': 1
    });
  });

  test('test_las_ordenes_quedan_pagadas_parciales_y_sin_pagar', async () => {
    const admin = await iniciarSesion('admin', process.env.SEED_ADMIN_PASSWORD);
    const estados = { PAID: 0, PARTIAL: 0, UNPAID: 0 };

    const [ordenes] = await pool.query("SELECT id FROM service_orders WHERE status IN ('TERMINADO', 'ENTREGADO')");
    for (const { id } of ordenes) {
      const res = await request(app).get(`/api/orders/${id}/payments`).set('Authorization', admin);
      const { summary } = res.body.data;
      estados[summary.status] += 1;
      expect(summary.paid).toBeLessThanOrEqual(summary.total);
      expect(summary.paid + summary.pending).toBeLessThanOrEqual(summary.total);
    }

    expect(estados).toEqual({ PAID: 3, PARTIAL: 2, UNPAID: 2 });
  });

  test('test_nunca_se_aprueba_mas_que_el_total_de_cada_orden', async () => {
    const [filas] = await pool.query(
      `SELECT o.id,
              (SELECT COALESCE(SUM(amount), 0) FROM order_services WHERE order_id = o.id)
                + (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE order_id = o.id)
                + (SELECT COALESCE(SUM(amount), 0) FROM order_parts WHERE order_id = o.id) AS total,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = o.id AND status = 'APROBADO') AS pagado
       FROM service_orders o`
    );
    for (const f of filas) expect(Number(f.pagado)).toBeLessThanOrEqual(Number(f.total));
  });

  test('test_solo_hay_un_cobro_de_mercado_pago_pendiente_por_orden', async () => {
    const [filas] = await pool.query(
      "SELECT order_id, COUNT(*) AS total FROM payments WHERE method = 'MERCADO_PAGO' AND status = 'PENDIENTE' GROUP BY order_id"
    );

    expect(filas).toHaveLength(1);
    expect(Number(filas[0].total)).toBe(1);
  });

  test('test_los_cobros_de_mercado_pago_llevan_referencias_ficticias_y_el_anulado_su_motivo', async () => {
    const [mp] = await pool.query("SELECT external_reference FROM payments WHERE method = 'MERCADO_PAGO'");
    expect(mp).toHaveLength(3);
    for (const f of mp) expect(f.external_reference).toContain('EJEMPLO');

    const [[anulado]] = await pool.query("SELECT void_reason, voided_by FROM payments WHERE status = 'ANULADO'");
    expect(anulado.void_reason).toBeTruthy();
    expect(anulado.voided_by).not.toBeNull();
  });

  test('test_no_hay_datos_de_tarjeta_ni_secretos', async () => {
    const [filas] = await pool.query('SELECT reference, external_reference, payment_url FROM payments');
    const texto = JSON.stringify(filas).toLowerCase();

    expect(texto).not.toMatch(/token|cvv|card_number|\d{13,19}/);
    expect(texto).not.toContain('app_usr');
  });
});

describe('tickets de ejemplo', () => {
  test('test_hay_cinco_tickets_con_folio_unico', async () => {
    expect(await contar('tickets')).toBe(5);
    expect(await contar('tickets', 'folio IS NULL')).toBe(0);
    const [[{ distintos }]] = await pool.query('SELECT COUNT(DISTINCT folio) AS distintos FROM tickets');
    expect(Number(distintos)).toBe(5);
    expect(await contar('tickets', "folio NOT REGEXP '^TK-[0-9]{6}$'")).toBe(0);
  });

  test('test_los_tickets_se_consultan_por_la_api_con_el_estado_de_pago_vigente', async () => {
    const recepcion = await iniciarSesion('recepcion', process.env.SEED_RECEPTION_PASSWORD);

    const res = await request(app).get('/api/tickets').set('Authorization', recepcion);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(5);
    const estados = res.body.data.map((t) => t.paymentStatus).sort();
    expect(estados).toEqual(['PAID', 'PAID', 'PAID', 'PARTIAL', 'PARTIAL']);
  });
});

describe('panel con los datos de ejemplo', () => {
  test('test_el_panel_muestra_indicadores_distintos_de_cero_y_cobrado_hoy_mayor_a_cero', async () => {
    const admin = await iniciarSesion('admin', process.env.SEED_ADMIN_PASSWORD);

    const res = await request(app).get('/api/dashboard').set('Authorization', admin);

    expect(res.status).toBe(200);
    const { payments, inventory, maintenance, orders } = res.body.data;
    expect(payments.collectedToday).toBeGreaterThan(0);
    expect(payments.pendingBalance).toBeGreaterThan(0);
    expect(payments.ordersToCollect).toBe(4);
    expect(inventory.low + inventory.out).toBeGreaterThan(0);
    expect(inventory.critical.length).toBeGreaterThan(0);
    expect(maintenance.overdue + maintenance.upcoming).toBeGreaterThan(0);
    expect(orders.finishedNotDelivered).toBe(1);
  });
});

describe('idempotencia', () => {
  test('test_ejecutar_los_seeds_dos_veces_mas_no_duplica_ningun_registro', async () => {
    const antes = {
      pagos: await contar('payments'),
      tickets: await contar('tickets'),
      ordenes: await contar('service_orders')
    };

    await runSeeds(conexion);
    await runSeeds(conexion);

    expect(await contar('payments')).toBe(antes.pagos);
    expect(await contar('tickets')).toBe(antes.tickets);
    expect(await contar('service_orders')).toBe(antes.ordenes);
  });
});
