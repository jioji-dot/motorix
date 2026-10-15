// Prueba de humo del esquema del Sprint 2 sobre la base `motorix_test`.
import {
  cleanTables,
  closePool,
  pool
} from '../helpers/testDb.js';
import {
  createClient,
  createOrder,
  createOrderLabor,
  createOrderService,
  createVehicle
} from '../helpers/factories.js';

beforeEach(cleanTables);
afterAll(closePool);

describe('esquema del Sprint 2', () => {
  test('test_las_cinco_tablas_existen_con_innodb_y_utf8mb4', async () => {
    const [tablas] = await pool.query(
      `SELECT table_name AS nombre, engine AS motor, table_collation AS collation
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN ('appointments','service_orders','order_services','order_labor','order_status_history')`
    );

    expect(tablas).toHaveLength(5);
    for (const tabla of tablas) {
      expect(tabla.motor).toBe('InnoDB');
      expect(tabla.collation).toMatch(/^utf8mb4_/);
    }
  });

  test('test_todas_las_llaves_foraneas_nuevas_usan_restrict', async () => {
    const [llaves] = await pool.query(
      `SELECT constraint_name AS nombre, delete_rule AS regla
       FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND table_name IN
         ('appointments','service_orders','order_services','order_labor','order_status_history')`
    );

    // appointments 3 + service_orders 5 + order_services 1 + order_labor 1 + order_status_history 2
    expect(llaves).toHaveLength(12);
    for (const llave of llaves) expect(llave.regla).toBe('RESTRICT');
  });

  test('test_el_importe_de_mano_de_obra_se_genera_con_round_horas_por_tarifa', async () => {
    const orden = await createOrder();

    const linea = await createOrderLabor(orden.id, { hours: 1.5, hourlyRate: 333.33 });

    const [[fila]] = await pool.query('SELECT amount FROM order_labor WHERE id = ?', [linea.id]);
    expect(Number(fila.amount)).toBe(500);
  });

  test('test_los_check_rechazan_importes_negativos_horas_cero_y_tarifas_negativas', async () => {
    const orden = await createOrder();

    await expect(createOrderService(orden.id, { amount: -1 })).rejects.toThrow();
    await expect(createOrderLabor(orden.id, { hours: 0 })).rejects.toThrow();
    await expect(createOrderLabor(orden.id, { hourlyRate: -5 })).rejects.toThrow();
    await expect(createOrderService(orden.id, { amount: 0 })).resolves.toBeDefined();
  });

  test('test_el_folio_es_unico', async () => {
    const cliente = await createClient();
    const vehiculo = await createVehicle(cliente.id);
    const orden = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id });
    const otra = await createOrder({ clientId: cliente.id, vehicleId: vehiculo.id });

    expect(orden.folio).toMatch(/^OS-\d{6}$/);
    expect(otra.folio).not.toBe(orden.folio);
    await expect(
      pool.query('UPDATE service_orders SET folio = ? WHERE id = ?', [orden.folio, otra.id])
    ).rejects.toThrow(/Duplicate/i);
  });

  test('test_no_se_puede_borrar_un_cliente_con_ordenes_por_restrict', async () => {
    const orden = await createOrder();

    await expect(
      pool.query('DELETE FROM clients WHERE id = ?', [orden.clientId])
    ).rejects.toThrow();
  });
});
