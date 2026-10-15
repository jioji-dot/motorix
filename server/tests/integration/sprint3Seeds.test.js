// Pruebas de integración de los datos de ejemplo del Sprint 3 sobre `motorix_test`.
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

const TABLAS = [
  'parts',
  'inventory_movements',
  'order_parts',
  'maintenance',
  'service_orders',
  'order_services',
  'order_labor',
  'order_status_history'
];

beforeAll(async () => {
  conexion = await openConnection();
});

beforeEach(async () => {
  await cleanTables();
  await runSeeds(conexion, { hasta: '003' });
});

afterAll(async () => {
  await conexion.end();
  await closePool();
});

describe('refacciones e inventario de ejemplo', () => {
  test('test_hay_quince_refacciones_catorce_activas_y_una_inactiva', async () => {
    expect(await contar('parts')).toBe(15);
    expect(await contar('parts', 'active = 1')).toBe(14);
    expect(await contar('parts', 'active = 0')).toBe(1);
  });

  test('test_hay_refacciones_con_existencia_normal_baja_y_agotada', async () => {
    const admin = await iniciarSesion('admin', process.env.SEED_ADMIN_PASSWORD);

    const alertas = await request(app).get('/api/parts/alerts').set('Authorization', admin);
    const bajas = await request(app).get('/api/parts?alert=LOW').set('Authorization', admin);
    const agotadas = await request(app).get('/api/parts?alert=OUT').set('Authorization', admin);

    expect(alertas.body.data).toEqual({ low: 3, out: 2, total: 5 });
    expect(bajas.body.data.map((p) => p.code).sort()).toEqual(['ACE-10W40', 'BAL-TRA', 'FIL-COMB']);
    expect(agotadas.body.data.map((p) => p.code).sort()).toEqual(['DIS-DEL', 'TERM-90']);
    expect(await contar('parts', 'active = 1 AND stock > minimum_stock')).toBe(9);
  });

  test('test_existen_movimientos_de_los_tres_tipos_y_las_salidas_estan_ligadas_a_ordenes', async () => {
    const [tipos] = await pool.query('SELECT type, COUNT(*) AS total FROM inventory_movements GROUP BY type');
    const porTipo = Object.fromEntries(tipos.map((t) => [t.type, Number(t.total)]));

    expect(porTipo.IN).toBeGreaterThan(0);
    expect(porTipo.OUT).toBeGreaterThan(0);
    expect(porTipo.ADJUSTMENT).toBeGreaterThan(0);
    expect(await contar('inventory_movements', "type = 'OUT' AND order_id IS NULL")).toBe(0);
    expect(await contar('inventory_movements', "reason NOT LIKE 'Semilla:%'")).toBe(0);
  });

  test('test_la_existencia_de_cada_refaccion_es_la_suma_de_sus_movimientos_y_nunca_negativa', async () => {
    const [filas] = await pool.query(
      `SELECT p.code, p.stock, COALESCE(SUM(m.quantity), 0) AS suma
       FROM parts p LEFT JOIN inventory_movements m ON m.part_id = p.id GROUP BY p.id`
    );

    expect(filas).toHaveLength(15);
    for (const fila of filas) {
      expect(Number(fila.suma)).toBe(fila.stock);
      expect(fila.stock).toBeGreaterThanOrEqual(0);
    }
  });

  test('test_cada_linea_de_refaccion_de_una_orden_tiene_su_salida_de_inventario', async () => {
    const [lineas] = await pool.query(
      `SELECT op.order_id, op.part_id, op.quantity,
              (SELECT COALESCE(SUM(-m.quantity), 0) FROM inventory_movements m
               WHERE m.order_id = op.order_id AND m.part_id = op.part_id AND m.type = 'OUT') AS salidas
       FROM order_parts op`
    );

    expect(lineas.length).toBeGreaterThanOrEqual(10);
    for (const linea of lineas) expect(Number(linea.salidas)).toBe(linea.quantity);
  });

  test('test_el_total_de_una_orden_de_ejemplo_incluye_las_refacciones', async () => {
    const admin = await iniciarSesion('admin', process.env.SEED_ADMIN_PASSWORD);
    const ordenes = await request(app).get('/api/orders?search=PRD482A').set('Authorization', admin);
    const afinacion = ordenes.body.data.find((o) => o.reportedProblem === 'Afinación mayor');

    const detalle = await request(app).get(`/api/orders/${afinacion.id}`).set('Authorization', admin);

    expect(detalle.body.data.parts.map((p) => p.code).sort()).toEqual(['BUJ-NGK', 'FIL-AIR', 'FIL-COMB', 'TERM-90']);
    expect(detalle.body.data.partsSubtotal).toBe(4 * 95 + 220 + 310 + 420);
    expect(detalle.body.data.total).toBe(
      detalle.body.data.servicesSubtotal + detalle.body.data.laborSubtotal + detalle.body.data.partsSubtotal
    );
  });
});

describe('historial y mantenimientos de ejemplo', () => {
  test('test_un_mismo_vehiculo_tiene_al_menos_tres_servicios_en_orden_cronologico_con_kilometraje', async () => {
    const mecanico = await iniciarSesion('mecanico', process.env.SEED_MECHANIC_PASSWORD);
    const [[vehiculo]] = await pool.query("SELECT id FROM vehicles WHERE license_plate = 'PRD482A'");

    const res = await request(app).get(`/api/vehicles/${vehiculo.id}/history`).set('Authorization', mecanico);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    const fechas = res.body.data.map((e) => new Date(e.serviceDate).getTime());
    expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
    expect(res.body.data.map((e) => e.mileage)).toEqual([47150, 44420, 40250]);
    expect(res.body.data.every((e) => e.status === 'ENTREGADO')).toBe(true);
  });

  test('test_algunas_ordenes_tienen_kilometraje_de_servicio', async () => {
    expect(await contar('service_orders', 'service_mileage IS NOT NULL')).toBe(5);
  });

  test('test_hay_mantenimientos_vencidos_proximos_lejanos_y_antecedentes', async () => {
    const recepcion = await iniciarSesion('recepcion', process.env.SEED_RECEPTION_PASSWORD);

    const alertas = await request(app).get('/api/maintenance').set('Authorization', recepcion);
    const pendientes = await request(app).get('/api/maintenance?status=PENDIENTE').set('Authorization', recepcion);
    const realizados = await request(app).get('/api/maintenance?status=REALIZADO').set('Authorization', recepcion);
    const cancelados = await request(app).get('/api/maintenance?status=CANCELADO').set('Authorization', recepcion);

    const clases = pendientes.body.data.map((m) => m.classification);
    expect(clases.filter((c) => c === 'OVERDUE')).toHaveLength(2);
    expect(clases.filter((c) => c === 'UPCOMING')).toHaveLength(2);
    expect(clases.filter((c) => c === 'LATER')).toHaveLength(1);
    expect(alertas.body.data).toHaveLength(4);
    expect(alertas.body.data.map((m) => m.classification)).toEqual(['OVERDUE', 'OVERDUE', 'UPCOMING', 'UPCOMING']);
    expect(realizados.body.data).toHaveLength(1);
    expect(cancelados.body.data).toHaveLength(1);
  });

  test('test_los_avisos_incluyen_el_nombre_y_el_telefono_del_cliente', async () => {
    const recepcion = await iniciarSesion('recepcion', process.env.SEED_RECEPTION_PASSWORD);

    const res = await request(app).get('/api/maintenance').set('Authorization', recepcion);

    for (const m of res.body.data) {
      expect(m.clientName).toEqual(expect.any(String));
      expect(m.clientPhone).toMatch(/^\d{10}$/);
    }
  });

  test('test_hay_a_lo_sumo_un_mantenimiento_pendiente_por_vehiculo', async () => {
    const [filas] = await pool.query(
      "SELECT vehicle_id, COUNT(*) AS total FROM maintenance WHERE status = 'PENDIENTE' GROUP BY vehicle_id"
    );

    expect(filas.length).toBe(5);
    for (const fila of filas) expect(Number(fila.total)).toBe(1);
  });
});

describe('idempotencia', () => {
  test('test_ejecutar_los_seeds_dos_veces_mas_no_duplica_ningun_registro', async () => {
    const antes = {};
    for (const tabla of TABLAS) antes[tabla] = await contar(tabla);
    const [existencias] = await pool.query('SELECT code, stock FROM parts ORDER BY code');

    await runSeeds(conexion, { hasta: '003' });
    await runSeeds(conexion, { hasta: '003' });

    for (const tabla of TABLAS) expect(await contar(tabla)).toBe(antes[tabla]);
    const [despues] = await pool.query('SELECT code, stock FROM parts ORDER BY code');
    expect(despues).toEqual(existencias);
  });

  test('test_volver_a_cargar_los_seeds_conserva_los_cambios_hechos_desde_la_aplicacion', async () => {
    const admin = await iniciarSesion('admin', process.env.SEED_ADMIN_PASSWORD);
    const [[pieza]] = await pool.query("SELECT id FROM parts WHERE code = 'ACE-10W40'");
    await request(app)
      .post(`/api/parts/${pieza.id}/entries`)
      .set('Authorization', admin)
      .send({ quantity: 10, reason: 'Compra posterior' });

    await runSeeds(conexion, { hasta: '003' });

    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(18);
  });
});
