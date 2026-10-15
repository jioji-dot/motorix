// Pruebas de integración del kilometraje de servicio (US2) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createClient,
  createOrder,
  createOrderLabor,
  createOrderService,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const trabajo = (auth, id, cuerpo) =>
  request(app).patch(`/api/orders/${id}/work`).set('Authorization', auth).send(cuerpo);
const detalle = (auth, id) => request(app).get(`/api/orders/${id}`).set('Authorization', auth);
const historial = (auth, vehicleId) =>
  request(app).get(`/api/vehicles/${vehicleId}/history`).set('Authorization', auth);

const kilometrajeDelVehiculo = async (vehicleId) => {
  const [[fila]] = await pool.query('SELECT current_mileage AS km FROM vehicles WHERE id = ?', [vehicleId]);
  return fila.km;
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
    status: 'EN_REPARACION',
    entryMileage: 20000
  });
});
afterAll(closePool);

describe('registrar el kilometraje de servicio', () => {
  test('test_guarda_el_kilometraje_y_actualiza_el_del_vehiculo', async () => {
    const res = await trabajo(mecanico.auth, orden.id, { serviceMileage: 20350 });

    expect(res.status).toBe(200);
    expect(res.body.data.serviceMileage).toBe(20350);
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(20350);
    expect((await detalle(mecanico.auth, orden.id)).body.data.serviceMileage).toBe(20350);
  });

  test('test_igual_al_de_entrada_se_acepta_y_no_cambia_el_del_vehiculo', async () => {
    const res = await trabajo(mecanico.auth, orden.id, { serviceMileage: 20000 });

    expect(res.status).toBe(200);
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(20000);
  });

  test('test_el_kilometraje_del_vehiculo_nunca_disminuye', async () => {
    await pool.query('UPDATE vehicles SET current_mileage = 21000 WHERE id = ?', [vehiculo.id]);

    const res = await trabajo(mecanico.auth, orden.id, { serviceMileage: 20500 });

    expect(res.status).toBe(200);
    expect(res.body.data.serviceMileage).toBe(20500);
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(21000);
  });

  test('test_se_puede_combinar_con_otros_datos_del_trabajo_en_la_misma_peticion', async () => {
    const res = await trabajo(mecanico.auth, orden.id, {
      diagnosis: 'Balatas gastadas',
      recommendations: 'Revisar llantas',
      serviceMileage: 20100
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ diagnosis: 'Balatas gastadas', recommendations: 'Revisar llantas', serviceMileage: 20100 })
    );
  });

  test('test_null_borra_el_kilometraje_de_servicio_sin_revertir_el_del_vehiculo', async () => {
    await trabajo(mecanico.auth, orden.id, { serviceMileage: 20350 });

    const res = await trabajo(mecanico.auth, orden.id, { serviceMileage: null });

    expect(res.status).toBe(200);
    expect(res.body.data.serviceMileage).toBeNull();
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(20350);
  });

  test.each(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO'])(
    'test_se_puede_registrar_en_el_estado_%s',
    async (estado) => {
      const otra = await createOrder({
        clientId: cliente.id,
        vehicleId: vehiculo.id,
        mechanicId: mecanico.user.id,
        status: estado,
        entryMileage: 20000
      });

      const res = await trabajo(mecanico.auth, otra.id, { serviceMileage: 20200 });

      expect(res.status).toBe(200);
    }
  );
});

describe('rechazos', () => {
  test('test_menor_al_de_entrada_se_rechaza_e_indica_el_de_entrada', async () => {
    const res = await trabajo(mecanico.auth, orden.id, { serviceMileage: 19999 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([
      { field: 'serviceMileage', message: expect.stringContaining('20000') }
    ]);
    expect((await detalle(mecanico.auth, orden.id)).body.data.serviceMileage).toBeNull();
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(20000);
  });

  test.each([
    ['negativo', -1],
    ['no entero', 20100.5],
    ['en texto', '20100'],
    ['demasiado grande', 4294967296]
  ])('test_rechaza_un_kilometraje_%s', async (_nombre, serviceMileage) => {
    const res = await trabajo(mecanico.auth, orden.id, { serviceMileage });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('serviceMileage');
  });

  test('test_una_orden_entregada_no_admite_cambiar_el_kilometraje_de_servicio', async () => {
    const entregada = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.user.id,
      status: 'ENTREGADO',
      entryMileage: 20000
    });

    const res = await trabajo(mecanico.auth, entregada.id, { serviceMileage: 20100 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
  });

  test('test_si_un_dato_del_trabajo_no_es_editable_no_se_guarda_ninguno_incluido_el_kilometraje', async () => {
    const terminada = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.user.id,
      status: 'TERMINADO',
      entryMileage: 20000,
      diagnosis: 'Original'
    });

    const res = await trabajo(mecanico.auth, terminada.id, { diagnosis: 'Cambio', serviceMileage: 20100 });

    expect(res.status).toBe(409);
    const [[fila]] = await pool.query('SELECT diagnosis, service_mileage FROM service_orders WHERE id = ?', [terminada.id]);
    expect(fila.diagnosis).toBe('Original');
    expect(fila.service_mileage).toBeNull();
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(20000);
  });

  test('test_un_mecanico_ajeno_recibe_404_y_la_recepcion_403', async () => {
    const otro = await createAuthenticated('MECHANIC');
    const recepcion = await createAuthenticated('RECEPTIONIST');

    expect((await trabajo(otro.auth, orden.id, { serviceMileage: 20100 })).status).toBe(404);
    expect((await trabajo(recepcion.auth, orden.id, { serviceMileage: 20100 })).status).toBe(403);
    expect(await kilometrajeDelVehiculo(vehiculo.id)).toBe(20000);
  });

  test('test_el_administrador_puede_registrar_el_kilometraje_de_cualquier_orden', async () => {
    const admin = await createAuthenticated('ADMIN');

    const res = await trabajo(admin.auth, orden.id, { serviceMileage: 20123 });

    expect(res.status).toBe(200);
  });
});

describe('efecto en el historial y en el resto del flujo', () => {
  test('test_el_historial_muestra_el_kilometraje_de_servicio_o_el_de_entrada_si_no_se_capturo', async () => {
    const conServicio = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.user.id,
      status: 'TERMINADO',
      entryMileage: 20000
    });
    await trabajo(mecanico.auth, conServicio.id, { serviceMileage: 20400 });
    const sinServicio = await createOrder({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: mecanico.user.id,
      status: 'TERMINADO',
      entryMileage: 18000
    });
    await pool.query(
      "UPDATE order_status_history SET created_at = '2020-01-01 10:00:00' WHERE order_id = ? AND to_status = 'TERMINADO'",
      [sinServicio.id]
    );

    const res = await historial(mecanico.auth, vehiculo.id);

    expect(res.body.data.map((e) => e.mileage)).toEqual([20400, 18000]);
  });

  test('test_terminar_la_orden_sin_kilometraje_de_servicio_sigue_funcionando', async () => {
    await createOrderService(orden.id, { amount: 100 });
    await createOrderLabor(orden.id, { hours: 1, hourlyRate: 100 });
    await trabajo(mecanico.auth, orden.id, { diagnosis: 'Listo' });

    const res = await request(app)
      .post(`/api/orders/${orden.id}/status`)
      .set('Authorization', mecanico.auth)
      .send({ status: 'TERMINADO' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TERMINADO');
    expect(res.body.data.serviceMileage).toBeNull();
  });

  test('test_una_peticion_sin_ningun_dato_del_trabajo_se_sigue_rechazando', async () => {
    const res = await trabajo(mecanico.auth, orden.id, {});

    expect(res.status).toBe(400);
  });
});
