// Pruebas de integración de los datos de ejemplo del Sprint 2 (US9) sobre `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { openConnection } from '../../scripts/migrate.js';
import { runSeeds } from '../../scripts/seed.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';

const app = createApp();
let conexion;

const contar = async (tabla, condicion = '1 = 1') => {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla} WHERE ${condicion}`);
  return total;
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
  await runSeeds(conexion, { hasta: '002' });
});

afterAll(async () => {
  await conexion.end();
  await closePool();
});

describe('citas de ejemplo', () => {
  test('test_existen_seis_citas_una_o_mas_en_cada_estado_esperado', async () => {
    expect(await contar('appointments')).toBe(6);
    const [filas] = await pool.query('SELECT status, COUNT(*) AS total FROM appointments GROUP BY status');
    const porEstado = Object.fromEntries(filas.map((f) => [f.status, Number(f.total)]));

    expect(porEstado).toEqual({ PENDIENTE: 2, CONFIRMADA: 1, EN_PROCESO: 1, COMPLETADA: 1, CANCELADA: 1 });
  });

  test('test_las_citas_abiertas_son_futuras_y_cada_cita_pertenece_al_cliente_de_su_vehiculo', async () => {
    expect(await contar('appointments', "status IN ('PENDIENTE', 'CONFIRMADA') AND scheduled_at > NOW()")).toBe(3);
    const [[{ incoherentes }]] = await pool.query(
      `SELECT COUNT(*) AS incoherentes FROM appointments a
       JOIN vehicles v ON v.id = a.vehicle_id WHERE v.client_id <> a.client_id`
    );
    expect(incoherentes).toBe(0);
  });
});

describe('órdenes de ejemplo', () => {
  test('test_existen_siete_ordenes_con_los_seis_estados_del_flujo', async () => {
    expect(await contar('service_orders')).toBe(7);
    const [filas] = await pool.query('SELECT DISTINCT status FROM service_orders');

    expect(filas.map((f) => f.status).sort()).toEqual(
      ['DIAGNOSTICO', 'EN_REPARACION', 'ENTREGADO', 'ESPERANDO_REFACCION', 'RECIBIDO', 'TERMINADO'].sort()
    );
  });

  test('test_varias_estan_asignadas_al_mecanico_de_ejemplo_y_al_menos_una_no_tiene_mecanico', async () => {
    const [[mecanico]] = await pool.query("SELECT id FROM users WHERE username = 'mecanico'");

    expect(await contar('service_orders', `mechanic_id = ${mecanico.id}`)).toBe(6);
    expect(await contar('service_orders', 'mechanic_id IS NULL')).toBe(1);
  });

  test('test_todas_tienen_folio_unico_con_el_formato_esperado', async () => {
    const [filas] = await pool.query('SELECT id, folio FROM service_orders');

    for (const fila of filas) expect(fila.folio).toBe(`OS-${String(fila.id).padStart(6, '0')}`);
    expect(new Set(filas.map((f) => f.folio)).size).toBe(7);
  });

  test('test_las_terminadas_y_entregadas_tienen_diagnostico_y_trabajo_registrado', async () => {
    const [filas] = await pool.query(
      `SELECT o.id, o.diagnosis,
              (SELECT COUNT(*) FROM order_services s WHERE s.order_id = o.id) AS servicios,
              (SELECT COUNT(*) FROM order_labor l WHERE l.order_id = o.id) AS mano
       FROM service_orders o WHERE o.status IN ('TERMINADO', 'ENTREGADO')`
    );

    expect(filas).toHaveLength(2);
    for (const fila of filas) {
      expect(fila.diagnosis).toBeTruthy();
      expect(Number(fila.servicios) + Number(fila.mano)).toBeGreaterThan(0);
    }
  });

  test('test_hay_ocho_servicios_y_cuatro_lineas_de_mano_de_obra_con_importe_calculado', async () => {
    expect(await contar('order_services')).toBe(8);
    expect(await contar('order_labor')).toBe(4);
    const [[linea]] = await pool.query(
      "SELECT hours, hourly_rate, amount FROM order_labor WHERE description = 'Revisión del circuito de enfriamiento'"
    );
    expect(Number(linea.amount)).toBe(Number(linea.hours) * Number(linea.hourly_rate));
  });

  test('test_el_kilometraje_de_entrada_coincide_con_el_del_vehiculo_y_los_vehiculos_no_cambian', async () => {
    const [[{ distintos }]] = await pool.query(
      `SELECT COUNT(*) AS distintos FROM service_orders o
       JOIN vehicles v ON v.id = o.vehicle_id WHERE o.entry_mileage <> v.current_mileage`
    );

    expect(distintos).toBe(0);
  });

  test('test_las_ordenes_de_citas_estan_vinculadas_y_coherentes_con_el_estado_de_la_cita', async () => {
    const [filas] = await pool.query(
      `SELECT a.status AS cita, o.status AS orden FROM appointments a
       JOIN service_orders o ON o.appointment_id = a.id ORDER BY a.id`
    );

    expect(filas).toEqual([
      { cita: 'EN_PROCESO', orden: 'EN_REPARACION' },
      { cita: 'COMPLETADA', orden: 'ENTREGADO' }
    ]);
  });
});

describe('historial de estados de ejemplo', () => {
  test('test_el_historial_de_cada_orden_termina_en_su_estado_actual', async () => {
    const [filas] = await pool.query(
      `SELECT o.id, o.status,
              (SELECT h.to_status FROM order_status_history h WHERE h.order_id = o.id ORDER BY h.id DESC LIMIT 1) AS ultimo,
              (SELECT h.from_status FROM order_status_history h WHERE h.order_id = o.id ORDER BY h.id ASC LIMIT 1) AS primero
       FROM service_orders o`
    );

    expect(filas).toHaveLength(7);
    for (const fila of filas) {
      expect(fila.ultimo).toBe(fila.status);
      expect(fila.primero).toBeNull();
    }
  });

  test('test_cada_orden_recorre_solo_transiciones_validas', async () => {
    const [filas] = await pool.query('SELECT from_status, to_status FROM order_status_history WHERE from_status IS NOT NULL');
    const validas = new Set([
      'RECIBIDO>DIAGNOSTICO',
      'DIAGNOSTICO>EN_REPARACION',
      'EN_REPARACION>ESPERANDO_REFACCION',
      'ESPERANDO_REFACCION>EN_REPARACION',
      'EN_REPARACION>TERMINADO',
      'TERMINADO>ENTREGADO'
    ]);

    for (const fila of filas) expect(validas.has(`${fila.from_status}>${fila.to_status}`)).toBe(true);
  });
});

describe('uso desde la aplicación', () => {
  test('test_el_mecanico_de_ejemplo_ve_solo_sus_ordenes_y_la_recepcion_ve_todas_las_citas_y_ordenes', async () => {
    const mecanico = await iniciarSesion('mecanico', process.env.SEED_MECHANIC_PASSWORD);
    const recepcion = await iniciarSesion('recepcion', process.env.SEED_RECEPTION_PASSWORD);

    const propias = await request(app).get('/api/orders').set('Authorization', mecanico);
    const todas = await request(app).get('/api/orders').set('Authorization', recepcion);
    const citas = await request(app).get('/api/appointments').set('Authorization', recepcion);

    expect(propias.body.meta.total).toBe(6);
    expect(propias.body.data.every((o) => o.mechanicName === 'Mecánico Motorix')).toBe(true);
    expect(todas.body.meta.total).toBe(7);
    expect(citas.body.meta.total).toBe(6);
    expect((await request(app).get('/api/appointments').set('Authorization', mecanico)).status).toBe(403);
  });

  test('test_el_detalle_de_una_orden_de_ejemplo_trae_totales_historial_y_acciones', async () => {
    const recepcion = await iniciarSesion('recepcion', process.env.SEED_RECEPTION_PASSWORD);
    const [[orden]] = await pool.query("SELECT id FROM service_orders WHERE status = 'TERMINADO'");

    const res = await request(app).get(`/api/orders/${orden.id}`).set('Authorization', recepcion);

    expect(res.body.data.total).toBe(1330);
    expect(res.body.data.statusHistory.map((h) => h.toStatus)).toEqual([
      'RECIBIDO',
      'DIAGNOSTICO',
      'EN_REPARACION',
      'TERMINADO'
    ]);
    expect(res.body.data.allowedTransitions).toEqual(['ENTREGADO']);
  });
});

describe('idempotencia', () => {
  test('test_cargar_los_seeds_varias_veces_deja_las_mismas_cantidades', async () => {
    const antes = {
      citas: await contar('appointments'),
      ordenes: await contar('service_orders'),
      servicios: await contar('order_services'),
      mano: await contar('order_labor'),
      historial: await contar('order_status_history')
    };

    await runSeeds(conexion, { hasta: '002' });
    await runSeeds(conexion, { hasta: '002' });

    expect({
      citas: await contar('appointments'),
      ordenes: await contar('service_orders'),
      servicios: await contar('order_services'),
      mano: await contar('order_labor'),
      historial: await contar('order_status_history')
    }).toEqual(antes);
  });

  test('test_no_toca_las_ordenes_creadas_desde_la_aplicacion', async () => {
    const recepcion = await iniciarSesion('recepcion', process.env.SEED_RECEPTION_PASSWORD);
    const [[auto]] = await pool.query("SELECT id, client_id FROM vehicles WHERE license_plate = 'POI374L'");
    const creada = await request(app).post('/api/orders').set('Authorization', recepcion).send({
      clientId: auto.client_id,
      vehicleId: auto.id,
      entryMileage: 9000,
      reportedProblem: 'Orden creada por el usuario'
    });
    const historialAntes = await contar('order_status_history', `order_id = ${creada.body.data.id}`);

    await runSeeds(conexion, { hasta: '002' });

    expect(await contar('service_orders')).toBe(8);
    expect(await contar('order_status_history', `order_id = ${creada.body.data.id}`)).toBe(historialAntes);
  });
});
