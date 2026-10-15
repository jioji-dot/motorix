// Pruebas de integración del próximo mantenimiento (US3) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createMaintenance,
  createOrder,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const p2 = (n) => String(n).padStart(2, '0');
/** Fecha local `YYYY-MM-DD` a `dias` días de hoy (negativo = pasado). */
function fechaEn(dias) {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${p2(f.getMonth() + 1)}-${p2(f.getDate())}`;
}

const crear = (auth, cuerpo) => request(app).post('/api/maintenance').set('Authorization', auth).send(cuerpo);
const editar = (auth, id, cuerpo) =>
  request(app).patch(`/api/maintenance/${id}`).set('Authorization', auth).send(cuerpo);
const cerrar = (auth, id, accion) =>
  request(app).post(`/api/maintenance/${id}/${accion}`).set('Authorization', auth);

const filasPendientes = async (vehicleId) => {
  const [filas] = await pool.query(
    "SELECT id, status, completed_at FROM maintenance WHERE vehicle_id = ? AND status = 'PENDIENTE'",
    [vehicleId]
  );
  return filas;
};

let mecanico;
let cliente;
let vehiculo;
let orden;

beforeEach(async () => {
  await cleanTables();
  mecanico = await createAuthenticated('MECHANIC');
  cliente = await createClient();
  vehiculo = await createVehicle(cliente.id, { currentMileage: 20000 });
  orden = await createOrder({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    mechanicId: mecanico.user.id,
    status: 'TERMINADO'
  });
});
afterAll(closePool);

describe('alta de mantenimientos', () => {
  test('test_registra_un_mantenimiento_por_fecha', async () => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Afinación', nextDate: fechaEn(60) });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        status: 'PENDIENTE',
        nextDate: fechaEn(60),
        nextMileage: null,
        vehicleId: vehiculo.id,
        orderId: orden.id,
        classification: 'LATER'
      })
    );
  });

  test('test_registra_un_mantenimiento_por_kilometraje', async () => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Cambio de aceite', nextMileage: 25000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ nextDate: null, nextMileage: 25000, kmRemaining: 5000 }));
  });

  test('test_registra_un_mantenimiento_por_fecha_y_kilometraje', async () => {
    const res = await crear(mecanico.auth, {
      orderId: orden.id,
      description: 'Revisión general',
      nextDate: fechaEn(20),
      nextMileage: 30000
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(
      expect.objectContaining({ nextDate: fechaEn(20), nextMileage: 30000, classification: 'UPCOMING' })
    );
  });

  test('test_la_descripcion_se_recorta_y_la_fecha_de_hoy_y_el_kilometraje_actual_se_aceptan', async () => {
    const res = await crear(mecanico.auth, {
      orderId: orden.id,
      description: '  Revisión  ',
      nextDate: fechaEn(0),
      nextMileage: 20000
    });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('Revisión');
    expect(res.body.data.classification).toBe('UPCOMING');
  });

  test('test_el_vehiculo_se_toma_de_la_orden', async () => {
    const otro = await createVehicle(cliente.id);
    const res = await crear(mecanico.auth, {
      orderId: orden.id,
      description: 'Revisión',
      nextMileage: 25000,
      vehicleId: otro.id
    });

    expect(res.body.data.vehicleId).toBe(vehiculo.id);
  });

  test('test_una_orden_entregada_tambien_permite_programar_el_mantenimiento', async () => {
    const entregada = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.user.id,
      status: 'ENTREGADO'
    });

    const res = await crear(mecanico.auth, { orderId: entregada.id, description: 'Revisión', nextMileage: 25000 });

    expect(res.status).toBe(201);
  });
});

describe('validaciones del alta', () => {
  test('test_exige_fecha_o_kilometraje', async () => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Revisión' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['nextDate']));
  });

  test('test_rechaza_una_fecha_anterior_a_hoy', async () => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Revisión', nextDate: fechaEn(-1) });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('nextDate');
    expect(await filasPendientes(vehiculo.id)).toHaveLength(0);
  });

  test.each([
    ['formato inválido', '14/10/2026'],
    ['día inexistente', '2027-02-30'],
    ['texto', 'mañana']
  ])('test_rechaza_una_fecha_con_%s', async (_nombre, nextDate) => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Revisión', nextDate });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('nextDate');
  });

  test('test_rechaza_un_kilometraje_menor_al_actual_del_vehiculo', async () => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Revisión', nextMileage: 19999 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('nextMileage');
  });

  test.each([
    ['negativo', -5],
    ['no entero', 25000.5],
    ['en texto', '25000']
  ])('test_rechaza_un_kilometraje_%s', async (_nombre, nextMileage) => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Revisión', nextMileage });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('nextMileage');
  });

  test.each([
    ['vacía', ''],
    ['solo espacios', '   '],
    ['demasiado larga', 'x'.repeat(256)]
  ])('test_rechaza_una_descripcion_%s', async (_nombre, description) => {
    const res = await crear(mecanico.auth, { orderId: orden.id, description, nextMileage: 25000 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('description');
  });

  test('test_rechaza_una_orden_que_aun_no_esta_terminada', async () => {
    for (const status of ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']) {
      const enCurso = await createOrder({
        clientId: cliente.id,
        vehicleId: vehiculo.id,
        mechanicId: mecanico.user.id,
        status
      });

      const res = await crear(mecanico.auth, { orderId: enCurso.id, description: 'Revisión', nextMileage: 25000 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_NOT_FINISHED');
    }
  });

  test('test_una_orden_inexistente_responde_404', async () => {
    const res = await crear(mecanico.auth, { orderId: 9999, description: 'Revisión', nextMileage: 25000 });

    expect(res.status).toBe(404);
  });
});

describe('un solo mantenimiento pendiente por vehículo', () => {
  test('test_un_segundo_pendiente_sin_confirmacion_responde_409_y_no_cambia_nada', async () => {
    const primero = await crear(mecanico.auth, { orderId: orden.id, description: 'Primero', nextMileage: 25000 });

    const res = await crear(mecanico.auth, { orderId: orden.id, description: 'Segundo', nextMileage: 26000 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MAINTENANCE_PENDING_EXISTS');
    expect(res.body.error.details.pending.id).toBe(primero.body.data.id);
    const pendientes = await filasPendientes(vehiculo.id);
    expect(pendientes.map((p) => p.id)).toEqual([primero.body.data.id]);
  });

  test('test_con_replace_pending_el_anterior_queda_cancelado_y_el_nuevo_pendiente', async () => {
    const primero = await crear(mecanico.auth, { orderId: orden.id, description: 'Primero', nextMileage: 25000 });

    const res = await crear(mecanico.auth, {
      orderId: orden.id,
      description: 'Segundo',
      nextMileage: 26000,
      replacePending: true
    });

    expect(res.status).toBe(201);
    const [[anterior]] = await pool.query('SELECT status, completed_at FROM maintenance WHERE id = ?', [
      primero.body.data.id
    ]);
    expect(anterior.status).toBe('CANCELADO');
    expect(anterior.completed_at).not.toBeNull();
    const pendientes = await filasPendientes(vehiculo.id);
    expect(pendientes.map((p) => p.id)).toEqual([res.body.data.id]);
  });

  test('test_replace_pending_sin_pendiente_previo_simplemente_crea_el_mantenimiento', async () => {
    const res = await crear(mecanico.auth, {
      orderId: orden.id,
      description: 'Único',
      nextMileage: 25000,
      replacePending: true
    });

    expect(res.status).toBe(201);
  });

  test('test_si_el_reemplazo_falla_por_validacion_el_pendiente_anterior_se_conserva', async () => {
    const primero = await crear(mecanico.auth, { orderId: orden.id, description: 'Primero', nextMileage: 25000 });

    const res = await crear(mecanico.auth, {
      orderId: orden.id,
      description: 'Inválido',
      nextMileage: 100,
      replacePending: true
    });

    expect(res.status).toBe(400);
    const pendientes = await filasPendientes(vehiculo.id);
    expect(pendientes.map((p) => p.id)).toEqual([primero.body.data.id]);
  });

  test('test_despues_de_realizar_o_cancelar_se_puede_registrar_otro_sin_confirmacion', async () => {
    const primero = await crear(mecanico.auth, { orderId: orden.id, description: 'Primero', nextMileage: 25000 });
    await cerrar(mecanico.auth, primero.body.data.id, 'complete');

    const segundo = await crear(mecanico.auth, { orderId: orden.id, description: 'Segundo', nextMileage: 26000 });
    await cerrar(mecanico.auth, segundo.body.data.id, 'cancel');
    const tercero = await crear(mecanico.auth, { orderId: orden.id, description: 'Tercero', nextMileage: 27000 });

    expect(segundo.status).toBe(201);
    expect(tercero.status).toBe(201);
  });

  test('test_dos_altas_simultaneas_dejan_un_solo_pendiente', async () => {
    const [a, b] = await Promise.all([
      crear(mecanico.auth, { orderId: orden.id, description: 'A', nextMileage: 25000 }),
      crear(mecanico.auth, { orderId: orden.id, description: 'B', nextMileage: 26000 })
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await filasPendientes(vehiculo.id)).toHaveLength(1);
  });

  test('test_los_pendientes_de_vehiculos_distintos_no_se_afectan', async () => {
    const otro = await createVehicle(cliente.id, { currentMileage: 100 });
    const ordenOtro = await createOrder({
      clientId: cliente.id,
      vehicleId: otro.id,
      mechanicId: mecanico.user.id,
      status: 'TERMINADO'
    });

    const a = await crear(mecanico.auth, { orderId: orden.id, description: 'A', nextMileage: 25000 });
    const b = await crear(mecanico.auth, { orderId: ordenOtro.id, description: 'B', nextMileage: 5000 });

    expect([a.status, b.status]).toEqual([201, 201]);
  });
});

describe('edición, realización y cancelación', () => {
  let pendiente;

  beforeEach(async () => {
    pendiente = await createMaintenance(vehiculo.id, {
      orderId: orden.id,
      description: 'Original',
      nextDate: fechaEn(30),
      nextMileage: 25000
    });
  });

  test('test_edita_descripcion_fecha_y_kilometraje', async () => {
    const res = await editar(mecanico.auth, pendiente.id, {
      description: '  Nueva  ',
      nextDate: fechaEn(45),
      nextMileage: 27000
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ description: 'Nueva', nextDate: fechaEn(45), nextMileage: 27000 })
    );
  });

  test('test_puede_quitar_la_fecha_si_queda_el_kilometraje_y_viceversa', async () => {
    const sinFecha = await editar(mecanico.auth, pendiente.id, { nextDate: null });
    const sinKm = await editar(mecanico.auth, pendiente.id, { nextDate: fechaEn(10), nextMileage: null });

    expect(sinFecha.status).toBe(200);
    expect(sinFecha.body.data.nextDate).toBeNull();
    expect(sinKm.status).toBe(200);
    expect(sinKm.body.data).toEqual(expect.objectContaining({ nextMileage: null, nextDate: fechaEn(10) }));
  });

  test('test_no_puede_quitar_fecha_y_kilometraje_a_la_vez', async () => {
    const res = await editar(mecanico.auth, pendiente.id, { nextDate: null, nextMileage: null });

    expect(res.status).toBe(400);
    const [[fila]] = await pool.query('SELECT next_mileage FROM maintenance WHERE id = ?', [pendiente.id]);
    expect(fila.next_mileage).toBe(25000);
  });

  test('test_quitar_el_unico_dato_restante_se_rechaza', async () => {
    await editar(mecanico.auth, pendiente.id, { nextDate: null });

    const res = await editar(mecanico.auth, pendiente.id, { nextMileage: null });

    expect(res.status).toBe(400);
  });

  test('test_la_edicion_aplica_las_mismas_validaciones_que_el_alta', async () => {
    const fechaPasada = await editar(mecanico.auth, pendiente.id, { nextDate: fechaEn(-3) });
    const kmBajo = await editar(mecanico.auth, pendiente.id, { nextMileage: 10 });
    const sinCambios = await editar(mecanico.auth, pendiente.id, {});

    expect(fechaPasada.status).toBe(400);
    expect(kmBajo.status).toBe(400);
    expect(sinCambios.status).toBe(400);
  });

  test('test_solo_se_editan_los_pendientes', async () => {
    const cerrado = await createMaintenance(vehiculo.id, { orderId: orden.id, status: 'REALIZADO' });

    const res = await editar(mecanico.auth, cerrado.id, { description: 'Cambio' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MAINTENANCE_NOT_PENDING');
  });

  test('test_marcar_como_realizado_lo_cierra_y_ya_no_aparece_como_pendiente', async () => {
    const res = await cerrar(mecanico.auth, pendiente.id, 'complete');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ status: 'REALIZADO', classification: null }));
    expect(await filasPendientes(vehiculo.id)).toHaveLength(0);
  });

  test('test_cancelar_lo_cierra_y_se_conserva_como_antecedente', async () => {
    const res = await cerrar(mecanico.auth, pendiente.id, 'cancel');

    expect(res.body.data.status).toBe('CANCELADO');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM maintenance WHERE id = ?', [pendiente.id]);
    expect(total).toBe(1);
  });

  test('test_cerrar_dos_veces_o_cambiar_de_cerrado_a_otro_estado_responde_409', async () => {
    await cerrar(mecanico.auth, pendiente.id, 'complete');

    const otraVez = await cerrar(mecanico.auth, pendiente.id, 'complete');
    const cancelar = await cerrar(mecanico.auth, pendiente.id, 'cancel');

    expect(otraVez.status).toBe(409);
    expect(cancelar.status).toBe(409);
  });

  test('test_un_mantenimiento_inexistente_responde_404', async () => {
    expect((await editar(mecanico.auth, 9999, { description: 'x' })).status).toBe(404);
    expect((await cerrar(mecanico.auth, 9999, 'complete')).status).toBe(404);
  });
});

describe('indicador canManage', () => {
  test('test_es_verdadero_para_el_mecanico_asignado_y_el_administrador_y_falso_para_los_demas', async () => {
    const m = await createMaintenance(vehiculo.id, { orderId: orden.id });
    const otro = await createAuthenticated('MECHANIC');
    const admin = await createAuthenticated('ADMIN');
    const recepcion = await createAuthenticated('RECEPTIONIST');
    const ver = async (auth) =>
      (await request(app).get(`/api/vehicles/${vehiculo.id}/maintenance`).set('Authorization', auth)).body.data[0]
        .canManage;

    expect(await ver(mecanico.auth)).toBe(true);
    expect(await ver(admin.auth)).toBe(true);
    expect(await ver(otro.auth)).toBe(false);
    expect(await ver(recepcion.auth)).toBe(false);
    expect(m.id).toBeGreaterThan(0);
  });

  test('test_es_falso_en_un_mantenimiento_cerrado_aunque_sea_el_mecanico_asignado', async () => {
    await createMaintenance(vehiculo.id, { orderId: orden.id, status: 'REALIZADO' });

    const res = await request(app)
      .get(`/api/vehicles/${vehiculo.id}/maintenance`)
      .set('Authorization', mecanico.auth);

    expect(res.body.data[0].canManage).toBe(false);
  });
});

describe('consulta por vehículo y detalle', () => {
  test('test_el_pendiente_va_primero_y_luego_los_cerrados_mas_recientes', async () => {
    const viejo = await createMaintenance(vehiculo.id, { orderId: orden.id, description: 'Viejo', status: 'REALIZADO' });
    const cancelado = await createMaintenance(vehiculo.id, { orderId: orden.id, description: 'Cancelado', status: 'CANCELADO' });
    const pendiente = await createMaintenance(vehiculo.id, { orderId: orden.id, description: 'Pendiente' });

    const res = await request(app)
      .get(`/api/vehicles/${vehiculo.id}/maintenance`)
      .set('Authorization', mecanico.auth);

    expect(res.body.data.map((m) => m.id)).toEqual([pendiente.id, cancelado.id, viejo.id]);
    expect(res.body.data[0].classification).not.toBeNull();
    expect(res.body.data[1].classification).toBeNull();
  });

  test('test_un_vehiculo_inexistente_responde_404', async () => {
    const res = await request(app).get('/api/vehicles/9999/maintenance').set('Authorization', mecanico.auth);

    expect(res.status).toBe(404);
  });

  test('test_un_vehiculo_sin_mantenimientos_devuelve_una_lista_vacia', async () => {
    const res = await request(app)
      .get(`/api/vehicles/${vehiculo.id}/maintenance`)
      .set('Authorization', mecanico.auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('test_el_detalle_de_un_mantenimiento_inexistente_responde_404', async () => {
    const res = await request(app).get('/api/maintenance/9999').set('Authorization', mecanico.auth);

    expect(res.status).toBe(404);
  });
});
