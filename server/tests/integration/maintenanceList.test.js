// Pruebas de integración del listado de mantenimientos próximos y vencidos (US4) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { MAINTENANCE_CLASSIFICATION } from '../../config/constants.js';
import { getMaintenanceThresholds } from '../../models/settingsModel.js';
import { classifyMaintenance } from '../../utils/maintenanceStatus.js';
import { todayLocal } from '../../utils/localDateTime.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMaintenance,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const p2 = (n) => String(n).padStart(2, '0');
function fechaEn(dias) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
}

const listar = (auth, consulta = '') => request(app).get(`/api/maintenance${consulta}`).set('Authorization', auth);

/** Crea un vehículo (con su cliente) y un mantenimiento pendiente. */
async function conMantenimiento({ currentMileage = 20000, cliente: datosCliente = {}, vehiculo: datosVehiculo = {}, ...mantenimiento }) {
  const cliente = await createClient(datosCliente);
  const vehiculo = await createVehicle(cliente.id, { currentMileage, ...datosVehiculo });
  const m = await createMaintenance(vehiculo.id, mantenimiento);
  return { cliente, vehiculo, m };
}

let recepcion;

/** Deja los umbrales iniciales de la migración (algunas pruebas los modifican o los borran). */
async function restaurarUmbrales() {
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES
       ('maintenance_warning_days', '30'), ('maintenance_warning_km', '1000')
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`
  );
}

beforeEach(async () => {
  await cleanTables();
  await restaurarUmbrales();
  recepcion = await createAuthenticated('RECEPTIONIST');
});
afterAll(async () => {
  await restaurarUmbrales(); // la base de pruebas se comparte con otros archivos
  await closePool();
});

describe('clasificación en el listado', () => {
  test('test_por_defecto_devuelve_vencidos_y_proximos_y_omite_los_lejanos', async () => {
    const vencido = await conMantenimiento({ nextDate: fechaEn(-5), nextMileage: null });
    const proximo = await conMantenimiento({ nextDate: fechaEn(10), nextMileage: null });
    await conMantenimiento({ nextDate: fechaEn(200), nextMileage: null });

    const res = await listar(recepcion.auth);

    expect(res.body.data.map((m) => m.id)).toEqual([vencido.m.id, proximo.m.id]);
    expect(res.body.data.map((m) => m.classification)).toEqual(['OVERDUE', 'UPCOMING']);
    expect(res.body.meta.total).toBe(2);
  });

  test('test_vencido_por_fecha_por_kilometraje_o_por_cualquiera_de_los_dos', async () => {
    const porFecha = await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null });
    const porKm = await conMantenimiento({ nextDate: null, nextMileage: 19999, currentMileage: 20000 });
    const mixtoFecha = await conMantenimiento({ nextDate: fechaEn(-2), nextMileage: 90000 });
    const mixtoKm = await conMantenimiento({ nextDate: fechaEn(300), nextMileage: 100, currentMileage: 500 });

    const res = await listar(recepcion.auth, '?classification=OVERDUE');

    expect(res.body.data.map((m) => m.id).sort((a, b) => a - b)).toEqual(
      [porFecha.m.id, porKm.m.id, mixtoFecha.m.id, mixtoKm.m.id].sort((a, b) => a - b)
    );
    for (const m of res.body.data) expect(m.classification).toBe('OVERDUE');
  });

  test('test_proximo_por_dias_y_por_kilometros_incluidos_los_limites', async () => {
    const hoy = await conMantenimiento({ nextDate: fechaEn(0), nextMileage: null });
    const limiteDias = await conMantenimiento({ nextDate: fechaEn(30), nextMileage: null });
    const pasadoLimiteDias = await conMantenimiento({ nextDate: fechaEn(31), nextMileage: null });
    const kmActual = await conMantenimiento({ nextDate: null, nextMileage: 20000, currentMileage: 20000 });
    const limiteKm = await conMantenimiento({ nextDate: null, nextMileage: 21000, currentMileage: 20000 });
    const pasadoLimiteKm = await conMantenimiento({ nextDate: null, nextMileage: 21001, currentMileage: 20000 });

    const res = await listar(recepcion.auth, '?classification=UPCOMING');
    const ids = res.body.data.map((m) => m.id);

    expect(ids.sort((a, b) => a - b)).toEqual(
      [hoy.m.id, limiteDias.m.id, kmActual.m.id, limiteKm.m.id].sort((a, b) => a - b)
    );
    expect(ids).not.toContain(pasadoLimiteDias.m.id);
    expect(ids).not.toContain(pasadoLimiteKm.m.id);
  });

  test('test_los_umbrales_se_leen_de_app_settings_sin_tocar_codigo', async () => {
    const m = await conMantenimiento({ nextDate: fechaEn(45), nextMileage: null });
    const antes = await listar(recepcion.auth);

    await pool.query("UPDATE app_settings SET setting_value = '60' WHERE setting_key = 'maintenance_warning_days'");
    const despues = await listar(recepcion.auth);

    expect(antes.body.data.map((x) => x.id)).not.toContain(m.m.id);
    expect(despues.body.data.map((x) => x.id)).toContain(m.m.id);
    expect(despues.body.meta.warningDays).toBe(60);
  });

  test('test_cambiar_el_umbral_de_kilometros_cambia_la_clasificacion', async () => {
    const m = await conMantenimiento({ nextDate: null, nextMileage: 22500, currentMileage: 20000 });
    expect((await listar(recepcion.auth)).body.data).toHaveLength(0);

    await pool.query("UPDATE app_settings SET setting_value = '3000' WHERE setting_key = 'maintenance_warning_km'");
    const res = await listar(recepcion.auth);

    expect(res.body.data.map((x) => x.id)).toEqual([m.m.id]);
    expect(res.body.meta.warningKm).toBe(3000);
  });

  test('test_si_falta_un_umbral_usa_el_respaldo_de_30_dias_y_1000_km', async () => {
    await pool.query('DELETE FROM app_settings');
    const dentro = await conMantenimiento({ nextDate: fechaEn(29), nextMileage: null });
    await conMantenimiento({ nextDate: fechaEn(40), nextMileage: null });

    const res = await listar(recepcion.auth);

    expect(res.body.data.map((m) => m.id)).toEqual([dentro.m.id]);
    expect(res.body.meta).toEqual(expect.objectContaining({ warningDays: 30, warningKm: 1000 }));
  });

  test('test_los_dias_y_kilometros_restantes_corresponden_a_cada_mantenimiento', async () => {
    await conMantenimiento({ nextDate: fechaEn(-4), nextMileage: 19500, currentMileage: 20000 });

    const res = await listar(recepcion.auth);

    expect(res.body.data[0]).toEqual(expect.objectContaining({ daysRemaining: -4, kmRemaining: -500 }));
  });

  test('test_la_clasificacion_en_sql_coincide_con_la_funcion_pura_para_distintas_combinaciones', async () => {
    const casos = [
      { nextDate: fechaEn(-30), nextMileage: null },
      { nextDate: fechaEn(0), nextMileage: null },
      { nextDate: fechaEn(15), nextMileage: 90000 },
      { nextDate: fechaEn(500), nextMileage: 20900 },
      { nextDate: null, nextMileage: 19000 },
      { nextDate: null, nextMileage: 20000 },
      { nextDate: null, nextMileage: 21500 },
      { nextDate: fechaEn(90), nextMileage: 99999 },
      { nextDate: fechaEn(-1), nextMileage: 1 }
    ];
    const creados = [];
    for (const caso of casos) creados.push({ ...caso, ...(await conMantenimiento({ ...caso, currentMileage: 20000 })) });
    const umbrales = await getMaintenanceThresholds();

    const res = await listar(recepcion.auth, '?status=PENDIENTE&pageSize=100');
    const porId = new Map(res.body.data.map((m) => [m.id, m.classification]));

    for (const c of creados) {
      const esperado = classifyMaintenance({
        nextDate: c.nextDate,
        nextMileage: c.nextMileage,
        currentMileage: 20000,
        today: todayLocal(),
        ...umbrales
      });
      expect(porId.get(c.m.id)).toBe(esperado);
    }
    expect(new Set(porId.values())).toEqual(
      new Set([MAINTENANCE_CLASSIFICATION.OVERDUE, MAINTENANCE_CLASSIFICATION.UPCOMING, MAINTENANCE_CLASSIFICATION.LATER])
    );
  });
});

describe('filtros, orden y búsqueda', () => {
  test('test_el_filtro_overdue_y_upcoming_devuelve_solo_cada_grupo', async () => {
    const vencido = await conMantenimiento({ nextDate: fechaEn(-3), nextMileage: null });
    const proximo = await conMantenimiento({ nextDate: fechaEn(3), nextMileage: null });

    const soloVencidos = await listar(recepcion.auth, '?classification=OVERDUE');
    const soloProximos = await listar(recepcion.auth, '?classification=UPCOMING');
    const ambos = await listar(recepcion.auth, '?classification=ALERT');

    expect(soloVencidos.body.data.map((m) => m.id)).toEqual([vencido.m.id]);
    expect(soloProximos.body.data.map((m) => m.id)).toEqual([proximo.m.id]);
    expect(ambos.body.data).toHaveLength(2);
  });

  test('test_ordena_vencidos_primero_el_mas_atrasado_antes_y_luego_proximos_por_cercania', async () => {
    const proximoLejano = await conMantenimiento({ nextDate: fechaEn(25), nextMileage: null });
    const proximoCercano = await conMantenimiento({ nextDate: fechaEn(2), nextMileage: null });
    const vencidoPoco = await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null });
    const vencidoMucho = await conMantenimiento({ nextDate: fechaEn(-20), nextMileage: null });

    const res = await listar(recepcion.auth);

    expect(res.body.data.map((m) => m.id)).toEqual([
      vencidoMucho.m.id,
      vencidoPoco.m.id,
      proximoCercano.m.id,
      proximoLejano.m.id
    ]);
  });

  test('test_busca_por_nombre_del_cliente_y_por_placa_con_o_sin_guiones', async () => {
    const ana = await conMantenimiento({
      nextDate: fechaEn(-1),
      nextMileage: null,
      cliente: { name: 'Ana Pérez' },
      vehiculo: { licensePlate: 'ABC123' }
    });
    await conMantenimiento({
      nextDate: fechaEn(-1),
      nextMileage: null,
      cliente: { name: 'Luis Gómez' },
      vehiculo: { licensePlate: 'XYZ789' }
    });

    const porCliente = await listar(recepcion.auth, '?search=ana');
    const porPlaca = await listar(recepcion.auth, '?search=abc-123');

    expect(porCliente.body.data.map((m) => m.id)).toEqual([ana.m.id]);
    expect(porPlaca.body.data.map((m) => m.id)).toEqual([ana.m.id]);
  });

  test('test_la_busqueda_trata_los_comodines_como_texto_literal', async () => {
    await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null, cliente: { name: 'Ana Pérez' } });

    const res = await listar(recepcion.auth, '?search=%25');

    expect(res.body.data).toHaveLength(0);
  });

  test('test_el_filtro_por_estado_ignora_la_clasificacion_y_muestra_los_cerrados', async () => {
    const realizado = await conMantenimiento({ nextDate: fechaEn(-100), nextMileage: null, status: 'REALIZADO' });
    const cancelado = await conMantenimiento({ nextDate: fechaEn(-100), nextMileage: null, status: 'CANCELADO' });
    await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null });

    const hechos = await listar(recepcion.auth, '?status=REALIZADO');
    const cancelados = await listar(recepcion.auth, '?status=CANCELADO');

    expect(hechos.body.data.map((m) => m.id)).toEqual([realizado.m.id]);
    expect(hechos.body.data[0].classification).toBeNull();
    expect(cancelados.body.data.map((m) => m.id)).toEqual([cancelado.m.id]);
  });

  test('test_el_filtro_pendiente_incluye_tambien_los_lejanos', async () => {
    const lejano = await conMantenimiento({ nextDate: fechaEn(400), nextMileage: null });

    const res = await listar(recepcion.auth, '?status=PENDIENTE');

    expect(res.body.data.map((m) => m.id)).toEqual([lejano.m.id]);
    expect(res.body.data[0].classification).toBe('LATER');
  });

  test('test_los_cerrados_no_aparecen_en_el_listado_de_avisos', async () => {
    await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null, status: 'REALIZADO' });

    const res = await listar(recepcion.auth);

    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('test_incluye_el_nombre_y_telefono_del_cliente_y_el_vehiculo', async () => {
    await conMantenimiento({
      nextDate: fechaEn(-1),
      nextMileage: null,
      cliente: { name: 'Ana Pérez', phone: '5512345678' },
      vehiculo: { licensePlate: 'ABC123', brand: 'Nissan', model: 'Versa' }
    });

    const res = await listar(recepcion.auth);

    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        clientName: 'Ana Pérez',
        clientPhone: '5512345678',
        vehiclePlate: 'ABC123',
        vehicleTitle: 'Nissan Versa'
      })
    );
  });

  test('test_pagina_los_resultados', async () => {
    for (let i = 1; i <= 5; i += 1) await conMantenimiento({ nextDate: fechaEn(-i), nextMileage: null });

    const res = await listar(recepcion.auth, '?page=2&pageSize=2');

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual(expect.objectContaining({ page: 2, pageSize: 2, total: 5 }));
  });

  test('test_sin_mantenimientos_devuelve_una_lista_vacia', async () => {
    const res = await listar(recepcion.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('permisos del listado', () => {
  test('test_el_administrador_y_la_recepcion_pueden_consultar_y_el_mecanico_no', async () => {
    await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null });
    const admin = await createAuthenticated('ADMIN');
    const mecanico = await createAuthenticated('MECHANIC');

    expect((await listar(admin.auth)).status).toBe(200);
    expect((await listar(recepcion.auth)).status).toBe(200);
    expect((await listar(mecanico.auth)).status).toBe(403);
    expect((await request(app).get('/api/maintenance')).status).toBe(401);
  });

  test('test_la_recepcion_no_recibe_acciones_de_gestion', async () => {
    await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null });

    const res = await listar(recepcion.auth);

    expect(res.body.data[0].canManage).toBe(false);
  });

  test('test_el_administrador_si_puede_gestionar_los_pendientes_del_listado', async () => {
    await conMantenimiento({ nextDate: fechaEn(-1), nextMileage: null });
    const admin = await createAuthenticated('ADMIN');

    const res = await listar(admin.auth);

    expect(res.body.data[0].canManage).toBe(true);
  });
});
