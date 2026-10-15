// Prueba de humo del esquema del Sprint 4 sobre la base `motorix_test`.
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import { createOrder, createPayment, createTicket } from '../helpers/factories.js';

beforeEach(cleanTables);
afterAll(closePool);

const insertar = (orderId, userId, datos = {}) => {
  const d = {
    method: 'CASH',
    amount: 100,
    status: 'APROBADO',
    externalReference: null,
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    ...datos
  };
  return pool.query(
    `INSERT INTO payments (order_id, method, amount, status, external_reference, void_reason, voided_by, voided_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, d.method, d.amount, d.status, d.externalReference, d.voidReason, d.voidedBy, d.voidedAt, userId]
  );
};

describe('esquema del Sprint 4', () => {
  test('test_las_tablas_nuevas_existen_con_innodb_y_utf8mb4', async () => {
    const [tablas] = await pool.query(
      `SELECT table_name AS nombre, engine AS motor, table_collation AS collation
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('payments','tickets')`
    );

    expect(tablas).toHaveLength(2);
    for (const tabla of tablas) {
      expect(tabla.motor).toBe('InnoDB');
      expect(tabla.collation).toMatch(/^utf8mb4_/);
    }
  });

  test('test_las_llaves_foraneas_nuevas_usan_restrict', async () => {
    const [llaves] = await pool.query(
      `SELECT constraint_name AS nombre, delete_rule AS regla
       FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND table_name IN ('payments','tickets')`
    );

    // payments 3 + tickets 2
    expect(llaves).toHaveLength(5);
    for (const llave of llaves) expect(llave.regla).toBe('RESTRICT');
  });

  test('test_el_check_rechaza_importes_cero_y_negativos', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });

    await expect(createPayment(orden.id, { amount: 0 })).rejects.toThrow();
    await expect(createPayment(orden.id, { amount: -5 })).rejects.toThrow();
    await expect(createPayment(orden.id, { amount: 0.01 })).resolves.toBeDefined();
  });

  test('test_un_pago_anulado_exige_motivo_usuario_y_fecha', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });
    const [[admin]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');

    await expect(insertar(orden.id, admin.id, { status: 'ANULADO' })).rejects.toThrow();
    await expect(
      insertar(orden.id, admin.id, { status: 'ANULADO', voidReason: 'Duplicado', voidedBy: admin.id })
    ).rejects.toThrow();
    await expect(
      insertar(orden.id, admin.id, {
        status: 'ANULADO',
        voidReason: 'Duplicado',
        voidedBy: admin.id,
        voidedAt: new Date()
      })
    ).resolves.toBeDefined();
  });

  test('test_un_metodo_manual_nunca_queda_pendiente_ni_rechazado', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });
    const [[usuario]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');

    for (const method of ['CASH', 'CARD', 'TRANSFER']) {
      await expect(insertar(orden.id, usuario.id, { method, status: 'PENDIENTE' })).rejects.toThrow();
      await expect(insertar(orden.id, usuario.id, { method, status: 'RECHAZADO' })).rejects.toThrow();
    }
  });

  test('test_mercado_pago_exige_referencia_externa_y_esta_es_unica', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });
    const otra = await createOrder({ status: 'TERMINADO' });
    const [[usuario]] = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');

    await expect(
      insertar(orden.id, usuario.id, { method: 'MERCADO_PAGO', status: 'PENDIENTE' })
    ).rejects.toThrow();
    await insertar(orden.id, usuario.id, { method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'MTX-1' });
    await expect(
      insertar(otra.id, usuario.id, { method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'MTX-1' })
    ).rejects.toThrow();
  });

  test('test_el_indice_unico_permite_un_solo_cobro_pendiente_de_mercado_pago_por_orden', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });
    const otra = await createOrder({ status: 'TERMINADO' });

    await createPayment(orden.id, { method: 'MERCADO_PAGO', status: 'PENDIENTE' });
    await expect(createPayment(orden.id, { method: 'MERCADO_PAGO', status: 'PENDIENTE' })).rejects.toThrow();
    // Cerrados, de otra orden y manuales sí se permiten.
    await createPayment(orden.id, { method: 'MERCADO_PAGO', status: 'APROBADO' });
    await createPayment(orden.id, { method: 'MERCADO_PAGO', status: 'CANCELADO' });
    await createPayment(otra.id, { method: 'MERCADO_PAGO', status: 'PENDIENTE' });
    await createPayment(orden.id, { method: 'CASH' });
    await createPayment(orden.id, { method: 'CASH' });

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM payments WHERE order_id = ?', [orden.id]);
    expect(total).toBe(5);
  });

  test('test_los_pagos_conservan_el_importe_exacto_con_centavos', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });

    const pago = await createPayment(orden.id, { amount: 1234.5 });

    const [[fila]] = await pool.query('SELECT amount FROM payments WHERE id = ?', [pago.id]);
    expect(Number(fila.amount)).toBe(1234.5);
  });

  test('test_un_ticket_por_orden_y_folio_unico', async () => {
    const orden = await createOrder({ status: 'TERMINADO' });
    const otra = await createOrder({ status: 'ENTREGADO' });

    const ticket = await createTicket(orden.id);
    await expect(createTicket(orden.id)).rejects.toThrow();
    const segundo = await createTicket(otra.id);

    expect(ticket.folio).toMatch(/^TK-\d{6}$/);
    expect(segundo.folio).not.toBe(ticket.folio);
  });

  test('test_la_migracion_agrega_las_claves_del_taller', async () => {
    const [ajustes] = await pool.query(
      "SELECT setting_key AS k, setting_value AS v FROM app_settings WHERE setting_key LIKE 'workshop_%'"
    );
    const mapa = Object.fromEntries(ajustes.map((a) => [a.k, a.v]));

    expect(mapa.workshop_name).toBe('Motorix Taller Mecánico');
    expect(mapa.workshop_address).toBeTruthy();
    expect(mapa.workshop_phone).toBeTruthy();
  });
});
