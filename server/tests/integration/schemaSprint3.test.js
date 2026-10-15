// Prueba de humo del esquema del Sprint 3 sobre la base `motorix_test`.
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createClient,
  createMaintenance,
  createMovement,
  createOrder,
  createOrderPart,
  createPart,
  createUser,
  createVehicle
} from '../helpers/factories.js';

beforeEach(cleanTables);
afterAll(closePool);

const TABLAS = ['app_settings', 'parts', 'inventory_movements', 'order_parts', 'maintenance'];

describe('esquema del Sprint 3', () => {
  test('test_las_tablas_nuevas_existen_con_innodb_y_utf8mb4', async () => {
    const [tablas] = await pool.query(
      `SELECT table_name AS nombre, engine AS motor, table_collation AS collation
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN (${TABLAS.map(() => '?').join(',')})`,
      TABLAS
    );

    expect(tablas).toHaveLength(TABLAS.length);
    for (const tabla of tablas) {
      expect(tabla.motor).toBe('InnoDB');
      expect(tabla.collation).toMatch(/^utf8mb4_/);
    }
  });

  test('test_las_llaves_foraneas_nuevas_usan_restrict', async () => {
    const [llaves] = await pool.query(
      `SELECT constraint_name AS nombre, delete_rule AS regla
       FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND table_name IN ('inventory_movements','order_parts','maintenance')`
    );

    // inventory_movements 3 + order_parts 2 + maintenance 3
    expect(llaves).toHaveLength(8);
    for (const llave of llaves) expect(llave.regla).toBe('RESTRICT');
  });

  test('test_la_migracion_agrega_el_kilometraje_de_servicio_y_los_umbrales_iniciales', async () => {
    const [[columna]] = await pool.query(
      `SELECT is_nullable AS nulo FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'service_orders' AND column_name = 'service_mileage'`
    );
    expect(columna.nulo).toBe('YES');

    const [ajustes] = await pool.query('SELECT setting_key AS k, setting_value AS v FROM app_settings');
    const mapa = Object.fromEntries(ajustes.map((a) => [a.k, a.v]));
    expect(mapa.maintenance_warning_days).toBe('30');
    expect(mapa.maintenance_warning_km).toBe('1000');
  });

  test('test_el_check_rechaza_existencia_negativa_en_refacciones', async () => {
    const pieza = await createPart({ stock: 2 });

    await expect(createMovement(pieza.id, { type: 'ADJUSTMENT', quantity: -3 })).rejects.toThrow();
    const [[fila]] = await pool.query('SELECT stock FROM parts WHERE id = ?', [pieza.id]);
    expect(fila.stock).toBe(2);
  });

  test('test_el_codigo_de_la_refaccion_es_unico_y_el_precio_no_puede_ser_negativo', async () => {
    const pieza = await createPart();

    await expect(createPart({ code: pieza.code })).rejects.toThrow();
    await expect(createPart({ price: -1 })).rejects.toThrow();
  });

  test('test_los_check_de_movimientos_rechazan_cantidad_cero_salida_positiva_y_salida_sin_orden', async () => {
    const pieza = await createPart({ stock: 5 });
    const admin = await createUser({ role: 'ADMIN' });
    const orden = await createOrder();
    const insertar = (tipo, cantidad, orderId) =>
      pool.query(
        'INSERT INTO inventory_movements (part_id, type, quantity, reason, order_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [pieza.id, tipo, cantidad, 'x', orderId, admin.id]
      );

    await expect(insertar('IN', 0, null)).rejects.toThrow();
    await expect(insertar('IN', -1, null)).rejects.toThrow();
    await expect(insertar('OUT', 1, orden.id)).rejects.toThrow();
    await expect(insertar('OUT', -1, null)).rejects.toThrow();
    await expect(insertar('OUT', -1, orden.id)).resolves.toBeDefined();
    await expect(insertar('ADJUSTMENT', -2, null)).resolves.toBeDefined();
  });

  test('test_la_linea_de_refaccion_calcula_el_importe_y_es_unica_por_orden_y_refaccion', async () => {
    const orden = await createOrder();
    const pieza = await createPart();

    const linea = await createOrderPart(orden.id, pieza.id, { quantity: 3, unitPrice: 33.33 });

    const [[fila]] = await pool.query('SELECT amount FROM order_parts WHERE id = ?', [linea.id]);
    expect(Number(fila.amount)).toBe(99.99);
    await expect(createOrderPart(orden.id, pieza.id)).rejects.toThrow();
    await expect(
      createOrderPart(orden.id, (await createPart()).id, { quantity: 0 })
    ).rejects.toThrow();
  });

  test('test_el_mantenimiento_exige_fecha_o_kilometraje', async () => {
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    await expect(
      createMaintenance(vehiculo.id, { nextDate: null, nextMileage: null })
    ).rejects.toThrow();
    await expect(
      createMaintenance(vehiculo.id, { nextDate: '2030-01-01', nextMileage: null })
    ).resolves.toBeDefined();
  });

  test('test_el_indice_unico_permite_un_solo_pendiente_por_vehiculo_y_varios_cerrados', async () => {
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);

    await createMaintenance(vehiculo.id);
    await expect(createMaintenance(vehiculo.id)).rejects.toThrow();
    await createMaintenance(vehiculo.id, { status: 'REALIZADO' });
    await createMaintenance(vehiculo.id, { status: 'CANCELADO' });
    await createMaintenance(vehiculo.id, { status: 'REALIZADO' });

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM maintenance WHERE vehicle_id = ?',
      [vehiculo.id]
    );
    expect(total).toBe(4);
  });
});
