// Pruebas de integración de los cambios de estado de la orden (US7) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAppointment,
  createAuthenticated,
  createClient,
  createMechanic,
  createOrder,
  createOrderLabor,
  createOrderService,
  createVehicle
} from '../helpers/factories.js';

const app = createApp();

const cambiar = (auth, id, status) =>
  request(app).post(`/api/orders/${id}/status`).set('Authorization', auth).send({ status });
const detalle = (auth, id) => request(app).get(`/api/orders/${id}`).set('Authorization', auth);
const trabajo = (auth, id, cuerpo) => request(app).patch(`/api/orders/${id}/work`).set('Authorization', auth).send(cuerpo);
const servicio = (auth, id, cuerpo) => request(app).post(`/api/orders/${id}/services`).set('Authorization', auth).send(cuerpo);

const ESTADOS = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO', 'ENTREGADO'];
const VALIDAS = {
  RECIBIDO: ['DIAGNOSTICO'],
  DIAGNOSTICO: ['EN_REPARACION'],
  EN_REPARACION: ['ESPERANDO_REFACCION', 'TERMINADO'],
  ESPERANDO_REFACCION: ['EN_REPARACION'],
  TERMINADO: ['ENTREGADO'],
  ENTREGADO: []
};

/** Orden con diagnóstico y un servicio, lista para poder terminarse. */
async function ordenDocumentada(estado, mechanicId) {
  const orden = await createOrder({ mechanicId, status: estado, diagnosis: 'Balatas gastadas' });
  await createOrderService(orden.id, { amount: 500 });
  return orden;
}

beforeEach(cleanTables);
afterAll(closePool);

describe('flujo completo de estados', () => {
  test('test_recorre_recibido_a_entregado_con_una_fila_de_historial_por_cambio', async () => {
    const recepcion = await createAuthenticated('RECEPTIONIST');
    const mecanico = await createAuthenticated('MECHANIC', { name: 'Mario Mecánico' });
    const cliente = await createClient();
    const auto = await createVehicle(cliente.id);
    const creada = await request(app).post('/api/orders').set('Authorization', recepcion.auth).send({
      clientId: cliente.id,
      vehicleId: auto.id,
      entryMileage: 1000,
      reportedProblem: 'Ruido',
      mechanicId: mecanico.user.id
    });
    const id = creada.body.data.id;

    expect((await cambiar(mecanico.auth, id, 'DIAGNOSTICO')).status).toBe(200);
    expect((await trabajo(mecanico.auth, id, { diagnosis: 'Balatas gastadas' })).status).toBe(200);
    expect((await cambiar(mecanico.auth, id, 'EN_REPARACION')).status).toBe(200);
    expect((await cambiar(mecanico.auth, id, 'ESPERANDO_REFACCION')).status).toBe(200);
    expect((await cambiar(mecanico.auth, id, 'EN_REPARACION')).status).toBe(200);
    expect((await servicio(mecanico.auth, id, { description: 'Balatas', amount: 850 })).status).toBe(201);
    expect((await cambiar(mecanico.auth, id, 'TERMINADO')).status).toBe(200);
    const entregada = await cambiar(recepcion.auth, id, 'ENTREGADO');

    expect(entregada.status).toBe(200);
    expect(entregada.body.data.status).toBe('ENTREGADO');
    expect(entregada.body.data.deliveredAt).not.toBeNull();
    const recorrido = entregada.body.data.statusHistory.map((h) => `${h.fromStatus ?? '-'}>${h.toStatus}`);
    expect(recorrido).toEqual([
      '->RECIBIDO',
      'RECIBIDO>DIAGNOSTICO',
      'DIAGNOSTICO>EN_REPARACION',
      'EN_REPARACION>ESPERANDO_REFACCION',
      'ESPERANDO_REFACCION>EN_REPARACION',
      'EN_REPARACION>TERMINADO',
      'TERMINADO>ENTREGADO'
    ]);
    const quien = entregada.body.data.statusHistory.map((h) => h.changedBy.id);
    expect(quien[1]).toBe(mecanico.user.id);
    expect(quien[6]).toBe(recepcion.user.id);
  });
});

describe('matriz de transiciones contra la API', () => {
  const pares = ESTADOS.flatMap((desde) => ESTADOS.map((hacia) => [desde, hacia]));

  test.each(pares)('test_del_estado_%s_al_estado_%s', async (desde, hacia) => {
    const admin = await createAuthenticated('ADMIN');
    const mecanico = await createMechanic();
    const orden = await ordenDocumentada(desde, mecanico.id);
    const esperada = VALIDAS[desde].includes(hacia);

    const res = await cambiar(admin.auth, orden.id, hacia);

    if (esperada) {
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(hacia);
    } else {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
      expect(res.body.error.details).toEqual({ from: desde, to: hacia, allowed: VALIDAS[desde] });
      expect((await detalle(admin.auth, orden.id)).body.data.status).toBe(desde);
    }
  });
});

describe('requisitos para avanzar', () => {
  test('test_no_se_avanza_una_orden_recibida_sin_mecanico', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await createOrder({ status: 'RECIBIDO', mechanicId: null });

    const res = await cambiar(auth, orden.id, 'DIAGNOSTICO');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MECHANIC_REQUIRED');
  });

  test.each([
    ['sin diagnóstico ni líneas', {}, ['diagnosis', 'servicesOrLabor']],
    ['sin diagnóstico pero con un servicio', { servicio: true }, ['diagnosis']],
    ['con diagnóstico pero sin servicios ni mano de obra', { diagnosis: 'Algo' }, ['servicesOrLabor']],
    ['con diagnóstico en blanco', { diagnosis: '   ', servicio: true }, ['diagnosis']]
  ])('test_no_se_termina_%s', async (_nombre, preparacion, faltante) => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({
      mechanicId: mecanico.user.id,
      status: 'EN_REPARACION',
      diagnosis: preparacion.diagnosis ?? null
    });
    if (preparacion.servicio) await createOrderService(orden.id);

    const res = await cambiar(mecanico.auth, orden.id, 'TERMINADO');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_INCOMPLETE');
    expect(res.body.error.details.missing).toEqual(faltante);
  });

  test.each([
    ['un servicio', async (id) => createOrderService(id)],
    ['una línea de mano de obra', async (id) => createOrderLabor(id)]
  ])('test_se_termina_con_diagnostico_y_%s', async (_nombre, agregar) => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION', diagnosis: 'Listo' });
    await agregar(orden.id);

    const res = await cambiar(mecanico.auth, orden.id, 'TERMINADO');

    expect(res.status).toBe(200);
  });
});

describe('permisos de los cambios de estado', () => {
  test('test_el_mecanico_asignado_avanza_hasta_terminado_pero_no_marca_entregado', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await ordenDocumentada('TERMINADO', mecanico.user.id);

    const res = await cambiar(mecanico.auth, orden.id, 'ENTREGADO');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test.each(['DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO'])(
    'test_la_recepcionista_no_puede_cambiar_a_%s',
    async (hacia) => {
      const { auth } = await createAuthenticated('RECEPTIONIST');
      const mecanico = await createMechanic();
      const orden = await ordenDocumentada('RECIBIDO', mecanico.id);

      const res = await cambiar(auth, orden.id, hacia);

      expect(res.status).toBe(403);
      expect((await detalle(auth, orden.id)).body.data.status).toBe('RECIBIDO');
    }
  );

  test.each(['RECEPTIONIST', 'ADMIN'])('test_el_rol_%s_marca_entregado_una_orden_terminada', async (rol) => {
    const { auth } = await createAuthenticated(rol);
    const mecanico = await createMechanic();
    const orden = await ordenDocumentada('TERMINADO', mecanico.id);

    const res = await cambiar(auth, orden.id, 'ENTREGADO');

    expect(res.status).toBe(200);
  });

  test('test_un_mecanico_ajeno_recibe_404', async () => {
    const otro = await createAuthenticated('MECHANIC');
    const duenio = await createMechanic();
    const orden = await ordenDocumentada('RECIBIDO', duenio.id);

    const res = await cambiar(otro.auth, orden.id, 'DIAGNOSTICO');

    expect(res.status).toBe(404);
  });

  test('test_una_orden_inexistente_responde_404_y_sin_sesion_401', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    expect((await cambiar(auth, 99999, 'DIAGNOSTICO')).status).toBe(404);
    expect((await request(app).post('/api/orders/1/status').send({ status: 'DIAGNOSTICO' })).status).toBe(401);
  });
});

describe('entrega', () => {
  test('test_entregar_deja_la_orden_inmodificable', async () => {
    const admin = await createAuthenticated('ADMIN');
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await ordenDocumentada('TERMINADO', mecanico.user.id);
    const linea = await createOrderService(orden.id);
    await cambiar(admin.auth, orden.id, 'ENTREGADO');

    const intentos = [
      await trabajo(mecanico.auth, orden.id, { notes: 'x' }),
      await trabajo(admin.auth, orden.id, { diagnosis: 'x' }),
      await servicio(admin.auth, orden.id, { description: 'x', amount: 1 }),
      await request(app).delete(`/api/orders/${orden.id}/services/${linea.id}`).set('Authorization', admin.auth),
      await request(app).patch(`/api/orders/${orden.id}`).set('Authorization', admin.auth).send({ reportedProblem: 'x' }),
      await cambiar(admin.auth, orden.id, 'EN_REPARACION')
    ];

    for (const res of intentos) expect(res.status).toBe(409);
  });

  test('test_entregar_marca_la_cita_vinculada_como_completada', async () => {
    const admin = await createAuthenticated('ADMIN');
    const mecanico = await createMechanic();
    const cliente = await createClient();
    const auto = await createVehicle(cliente.id);
    const cita = await createAppointment(cliente.id, auto.id);
    const creada = await request(app).post('/api/orders').set('Authorization', admin.auth).send({
      appointmentId: cita.id,
      entryMileage: 500,
      mechanicId: mecanico.id
    });
    const id = creada.body.data.id;
    await pool.query("UPDATE service_orders SET status = 'TERMINADO', diagnosis = 'ok' WHERE id = ?", [id]);

    await cambiar(admin.auth, id, 'ENTREGADO');

    const citaFinal = await request(app).get(`/api/appointments/${cita.id}`).set('Authorization', admin.auth);
    expect(citaFinal.body.data.status).toBe('COMPLETADA');
  });

  test('test_entregar_una_orden_sin_cita_no_falla', async () => {
    const admin = await createAuthenticated('ADMIN');
    const orden = await ordenDocumentada('TERMINADO', null);

    const res = await cambiar(admin.auth, orden.id, 'ENTREGADO');

    expect(res.status).toBe(200);
    expect(res.body.data.appointmentId).toBeNull();
  });

  test('test_las_ordenes_entregadas_se_conservan_y_no_hay_ruta_para_eliminarlas', async () => {
    const admin = await createAuthenticated('ADMIN');
    const orden = await ordenDocumentada('ENTREGADO', null);

    const eliminar = await request(app).delete(`/api/orders/${orden.id}`).set('Authorization', admin.auth);

    expect([404, 405]).toContain(eliminar.status);
    expect((await detalle(admin.auth, orden.id)).status).toBe(200);
  });
});

describe('concurrencia', () => {
  test('test_dos_cambios_simultaneos_de_la_misma_transicion_solo_aplican_uno', async () => {
    const admin = await createAuthenticated('ADMIN');
    const mecanico = await createMechanic();
    const orden = await ordenDocumentada('RECIBIDO', mecanico.id);

    const [a, b] = await Promise.all([
      cambiar(admin.auth, orden.id, 'DIAGNOSTICO'),
      cambiar(admin.auth, orden.id, 'DIAGNOSTICO')
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM order_status_history WHERE order_id = ? AND to_status = 'DIAGNOSTICO'",
      [orden.id]
    );
    expect(total).toBe(1);
  });

  test('test_dos_cambios_distintos_desde_en_reparacion_dejan_un_solo_estado_coherente', async () => {
    const admin = await createAuthenticated('ADMIN');
    const mecanico = await createMechanic();
    const orden = await ordenDocumentada('EN_REPARACION', mecanico.id);

    const [a, b] = await Promise.all([
      cambiar(admin.auth, orden.id, 'ESPERANDO_REFACCION'),
      cambiar(admin.auth, orden.id, 'TERMINADO')
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const final = (await detalle(admin.auth, orden.id)).body.data;
    const ganador = a.status === 200 ? 'ESPERANDO_REFACCION' : 'TERMINADO';
    expect(final.status).toBe(ganador);
    expect(final.statusHistory.at(-1).toStatus).toBe(ganador);
  });
});
