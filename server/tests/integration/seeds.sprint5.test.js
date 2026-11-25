// Los datos de ejemplo bastan para demostrar el cobro con refacciones y son idempotentes (Sprint 5, FR-021).
// El sprint no agrega seeds: se comprueba que los existentes cargan dos veces sin duplicar y que lo ya emitido
// (pagos y tickets del seed 008) no cambia al cambiar los precios de las refacciones (FR-013).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { aplicarSeeds, cerrarConexiones, emitirToken, limpiarBase } from '../helpers.js';

const TABLAS = [
  'users', 'clients', 'vehicles', 'appointments', 'service_orders', 'order_services', 'order_labor', 'order_parts',
  'parts', 'inventory_movements', 'maintenance', 'payments', 'tickets', 'notification_reads', 'client_notices', 'settings', 'service_types', 'terms_versions', 'terms_acceptances', 'audit_log',
];

const conteos = async () => {
  const resultado = {};
  for (const tabla of TABLAS) {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`);
    resultado[tabla] = total;
  }
  return resultado;
};

beforeAll(async () => {
  await limpiarBase();
}, 60000);

afterAll(cerrarConexiones);

describe('Datos de ejemplo del cobro con refacciones (integración, Sprint 5)', () => {
  let primeraCarga;

  test('los_seeds_cargan_dos_veces_sin_duplicar_ningun_registro', async () => {
    aplicarSeeds();
    primeraCarga = await conteos();
    expect(primeraCarga.parts).toBeGreaterThan(0);
    expect(primeraCarga.order_parts).toBeGreaterThan(0);
    aplicarSeeds();
    expect(await conteos()).toEqual(primeraCarga);
  }, 120000);

  test('todas_las_refacciones_de_ejemplo_tienen_categoria_marca_y_precios', async () => {
    const [partes] = await pool.query('SELECT category, brand, purchasePrice, salePrice FROM parts');
    expect(partes.length).toBeGreaterThan(0);
    for (const p of partes) {
      expect(p.category).toBeTruthy();
      expect(p.brand).toBeTruthy();
      expect(Number(p.purchasePrice)).toBeGreaterThanOrEqual(0);
      expect(Number(p.salePrice)).toBeGreaterThanOrEqual(0);
    }
  });

  test('hay_una_orden_terminada_con_refacciones_y_saldo_pendiente_y_una_entregada_pagada', async () => {
    const [ordenes] = await pool.query(
      `SELECT o.folio, o.status, o.total,
              (SELECT COUNT(*) FROM order_parts p WHERE p.orderId = o.id) AS lineas,
              (SELECT COALESCE(SUM(y.amount), 0) FROM payments y WHERE y.orderId = o.id AND y.status = 'PAGADO') AS pagado
         FROM service_orders o`,
    );
    const cobrable = ordenes.find((o) => o.status === 'TERMINADO' && o.lineas > 0 && Number(o.pagado) < Number(o.total));
    expect(cobrable).toBeDefined();
    const pagada = ordenes.find((o) => o.status === 'ENTREGADO' && o.lineas > 0 && Number(o.pagado) === Number(o.total));
    expect(pagada).toBeDefined();
  });

  test('el_total_de_cada_orden_de_ejemplo_coincide_con_la_suma_de_sus_lineas', async () => {
    const [filas] = await pool.query(
      `SELECT o.folio, o.total,
              (SELECT COALESCE(SUM(amount), 0) FROM order_services WHERE orderId = o.id)
            + (SELECT COALESCE(SUM(amount), 0) FROM order_labor WHERE orderId = o.id)
            + (SELECT COALESCE(SUM(amount), 0) FROM order_parts WHERE orderId = o.id) AS suma
         FROM service_orders o`,
    );
    expect(filas.filter((f) => Number(f.total).toFixed(2) !== Number(f.suma).toFixed(2)).map((f) => f.folio)).toEqual([]);
  });

  test('cambiar_el_precio_de_todas_las_refacciones_no_altera_los_pagos_ni_los_tickets_sembrados', async () => {
    const [[admin]] = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
    const encabezado = { Authorization: `Bearer ${emitirToken(admin.id)}` };
    const instantanea = async () => {
      const [pagos] = await pool.query('SELECT * FROM payments ORDER BY id');
      const [ordenes] = await pool.query('SELECT id, total FROM service_orders ORDER BY id');
      const [conTicket] = await pool.query('SELECT orderId FROM tickets ORDER BY id');
      const tickets = [];
      for (const { orderId } of conTicket) tickets.push((await request(app).get(`/api/orders/${orderId}/ticket`).set(encabezado)).body);
      return { pagos, ordenes, tickets };
    };

    const antes = await instantanea();
    expect(antes.pagos.length).toBeGreaterThan(0);
    expect(antes.tickets.length).toBeGreaterThan(0);

    const [partes] = await pool.query('SELECT id FROM parts');
    for (const { id } of partes) {
      const cambio = await request(app).patch(`/api/parts/${id}`).set(encabezado).send({ salePrice: 999, confirmBelowCost: true });
      expect(cambio.status).toBe(200);
    }
    expect(await instantanea()).toEqual(antes);
  }, 60000);
});
