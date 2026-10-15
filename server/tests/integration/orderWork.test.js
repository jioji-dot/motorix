// Pruebas de integración del trabajo técnico de la orden (US6 y US8) contra `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';
import {
  createAuthenticated,
  createOrder,
  createOrderLabor,
  createOrderService
} from '../helpers/factories.js';

const app = createApp();

const trabajo = (auth, id, cuerpo) => request(app).patch(`/api/orders/${id}/work`).set('Authorization', auth).send(cuerpo);
const agregarServicio = (auth, id, cuerpo) =>
  request(app).post(`/api/orders/${id}/services`).set('Authorization', auth).send(cuerpo);
const agregarMano = (auth, id, cuerpo) =>
  request(app).post(`/api/orders/${id}/labor`).set('Authorization', auth).send(cuerpo);
const detalle = (auth, id) => request(app).get(`/api/orders/${id}`).set('Authorization', auth);

const ESTADOS_DE_TRABAJO = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'];

async function mecanicoConOrden(estado = 'EN_REPARACION', extra = {}) {
  const mecanico = await createAuthenticated('MECHANIC');
  const orden = await createOrder({ mechanicId: mecanico.user.id, status: estado, ...extra });
  return { ...mecanico, orden };
}

beforeEach(cleanTables);
afterAll(closePool);

describe('diagnóstico', () => {
  test.each(ESTADOS_DE_TRABAJO)('test_el_mecanico_registra_el_diagnostico_en_%s', async (estado) => {
    const { auth, orden } = await mecanicoConOrden(estado);

    const res = await trabajo(auth, orden.id, { diagnosis: '  Balatas gastadas  ' });

    expect(res.status).toBe(200);
    expect(res.body.data.diagnosis).toBe('Balatas gastadas');
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_rechaza_el_diagnostico_en_%s', async (estado) => {
    const { auth, orden } = await mecanicoConOrden(estado, { diagnosis: 'Original' });

    const res = await trabajo(auth, orden.id, { diagnosis: 'Cambio' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    expect((await detalle(auth, orden.id)).body.data.diagnosis).toBe('Original');
  });

  test('test_vaciar_el_diagnostico_lo_deja_en_null', async () => {
    const { auth, orden } = await mecanicoConOrden('DIAGNOSTICO', { diagnosis: 'Algo' });

    const res = await trabajo(auth, orden.id, { diagnosis: '   ' });

    expect(res.body.data.diagnosis).toBeNull();
  });

  test('test_rechaza_un_diagnostico_de_mas_de_5000_caracteres', async () => {
    const { auth, orden } = await mecanicoConOrden();

    const res = await trabajo(auth, orden.id, { diagnosis: 'a'.repeat(5001) });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain('diagnosis');
  });

  test('test_una_edicion_vacia_responde_400', async () => {
    const { auth, orden } = await mecanicoConOrden();

    expect((await trabajo(auth, orden.id, {})).status).toBe(400);
  });
});

describe('servicios realizados', () => {
  test.each(ESTADOS_DE_TRABAJO)('test_agrega_un_servicio_en_%s', async (estado) => {
    const { auth, orden } = await mecanicoConOrden(estado);

    const res = await agregarServicio(auth, orden.id, { description: '  Cambio de aceite ', amount: 450 });

    expect(res.status).toBe(201);
    expect(res.body.data.services).toEqual([{ id: expect.any(Number), description: 'Cambio de aceite', amount: 450 }]);
  });

  test('test_acepta_un_importe_en_cero_y_con_dos_decimales', async () => {
    const { auth, orden } = await mecanicoConOrden();

    expect((await agregarServicio(auth, orden.id, { description: 'Cortesía', amount: 0 })).status).toBe(201);
    const res = await agregarServicio(auth, orden.id, { description: 'Revisión', amount: 99.99 });

    expect(res.status).toBe(201);
    expect(res.body.data.servicesSubtotal).toBe(99.99);
  });

  test.each([
    ['sin descripción', { amount: 10 }, 'description'],
    ['con descripción vacía', { description: '  ', amount: 10 }, 'description'],
    ['con descripción de más de 255 caracteres', { description: 'a'.repeat(256), amount: 10 }, 'description'],
    ['sin importe', { description: 'Servicio' }, 'amount'],
    ['con importe negativo', { description: 'Servicio', amount: -1 }, 'amount'],
    ['con importe en texto', { description: 'Servicio', amount: '100' }, 'amount'],
    ['con más de dos decimales', { description: 'Servicio', amount: 10.555 }, 'amount'],
    ['con importe demasiado grande', { description: 'Servicio', amount: 1e9 }, 'amount']
  ])('test_rechaza_un_servicio_%s', async (_nombre, cuerpo, campo) => {
    const { auth, orden } = await mecanicoConOrden();

    const res = await agregarServicio(auth, orden.id, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM order_services');
    expect(total).toBe(0);
  });

  test('test_edita_y_quita_un_servicio_y_recalcula_los_subtotales', async () => {
    const { auth, orden } = await mecanicoConOrden();
    const a = await createOrderService(orden.id, { description: 'A', amount: 100 });
    const b = await createOrderService(orden.id, { description: 'B', amount: 50 });

    const editado = await request(app)
      .patch(`/api/orders/${orden.id}/services/${a.id}`)
      .set('Authorization', auth)
      .send({ description: 'A corregido', amount: 120.5 });
    const quitado = await request(app).delete(`/api/orders/${orden.id}/services/${b.id}`).set('Authorization', auth);

    expect(editado.status).toBe(200);
    expect(editado.body.data.services.find((s) => s.id === a.id)).toEqual({
      id: a.id,
      description: 'A corregido',
      amount: 120.5
    });
    expect(editado.body.data.servicesSubtotal).toBe(170.5);
    expect(quitado.body.data.services.map((s) => s.id)).toEqual([a.id]);
    expect(quitado.body.data.servicesSubtotal).toBe(120.5);
  });

  test('test_editar_con_los_mismos_valores_responde_200', async () => {
    const { auth, orden } = await mecanicoConOrden();
    const linea = await createOrderService(orden.id, { description: 'A', amount: 100 });

    const res = await request(app)
      .patch(`/api/orders/${orden.id}/services/${linea.id}`)
      .set('Authorization', auth)
      .send({ description: 'A', amount: 100 });

    expect(res.status).toBe(200);
  });

  test('test_un_servicio_de_otra_orden_responde_404', async () => {
    const { auth, orden } = await mecanicoConOrden();
    const otraOrden = await createOrder({ status: 'EN_REPARACION' });
    const ajena = await createOrderService(otraOrden.id);

    const editar = await request(app)
      .patch(`/api/orders/${orden.id}/services/${ajena.id}`)
      .set('Authorization', auth)
      .send({ amount: 1 });
    const quitar = await request(app).delete(`/api/orders/${orden.id}/services/${ajena.id}`).set('Authorization', auth);

    expect(editar.status).toBe(404);
    expect(quitar.status).toBe(404);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM order_services');
    expect(total).toBe(1);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_no_se_modifican_servicios_en_%s', async (estado) => {
    const { auth, orden } = await mecanicoConOrden(estado);
    const linea = await createOrderService(orden.id);

    const alta = await agregarServicio(auth, orden.id, { description: 'Extra', amount: 10 });
    const edicion = await request(app).patch(`/api/orders/${orden.id}/services/${linea.id}`).set('Authorization', auth).send({ amount: 1 });
    const baja = await request(app).delete(`/api/orders/${orden.id}/services/${linea.id}`).set('Authorization', auth);

    for (const res of [alta, edicion, baja]) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    }
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM order_services');
    expect(total).toBe(1);
  });
});

describe('mano de obra', () => {
  test('test_agrega_mano_de_obra_con_el_importe_calculado_horas_por_tarifa', async () => {
    const { auth, orden } = await mecanicoConOrden();

    const res = await agregarMano(auth, orden.id, { description: 'Montaje', hours: 1.5, hourlyRate: 333.33 });

    expect(res.status).toBe(201);
    expect(res.body.data.labor[0]).toEqual({
      id: expect.any(Number),
      description: 'Montaje',
      hours: 1.5,
      hourlyRate: 333.33,
      amount: 500
    });
    expect(res.body.data.laborSubtotal).toBe(500);
  });

  test.each([
    ['sin descripción', { hours: 1, hourlyRate: 100 }, 'description'],
    ['con horas en cero', { description: 'M', hours: 0, hourlyRate: 100 }, 'hours'],
    ['con horas negativas', { description: 'M', hours: -2, hourlyRate: 100 }, 'hours'],
    ['con horas en texto', { description: 'M', hours: '2', hourlyRate: 100 }, 'hours'],
    ['con más de dos decimales en horas', { description: 'M', hours: 1.555, hourlyRate: 100 }, 'hours'],
    ['con horas mayores a 9999.99', { description: 'M', hours: 10000, hourlyRate: 100 }, 'hours'],
    ['sin tarifa', { description: 'M', hours: 1 }, 'hourlyRate'],
    ['con tarifa negativa', { description: 'M', hours: 1, hourlyRate: -5 }, 'hourlyRate'],
    ['con más de dos decimales en la tarifa', { description: 'M', hours: 1, hourlyRate: 10.555 }, 'hourlyRate'],
    ['con tarifa demasiado grande', { description: 'M', hours: 1, hourlyRate: 1e6 }, 'hourlyRate']
  ])('test_rechaza_mano_de_obra_%s', async (_nombre, cuerpo, campo) => {
    const { auth, orden } = await mecanicoConOrden();

    const res = await agregarMano(auth, orden.id, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field)).toContain(campo);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM order_labor');
    expect(total).toBe(0);
  });

  test('test_acepta_tarifa_en_cero', async () => {
    const { auth, orden } = await mecanicoConOrden();

    const res = await agregarMano(auth, orden.id, { description: 'Garantía', hours: 2, hourlyRate: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.labor[0].amount).toBe(0);
  });

  test('test_edita_y_quita_mano_de_obra', async () => {
    const { auth, orden } = await mecanicoConOrden();
    const linea = await createOrderLabor(orden.id, { hours: 1, hourlyRate: 100 });

    const editada = await request(app)
      .patch(`/api/orders/${orden.id}/labor/${linea.id}`)
      .set('Authorization', auth)
      .send({ hours: 3, hourlyRate: 120 });
    const quitada = await request(app).delete(`/api/orders/${orden.id}/labor/${linea.id}`).set('Authorization', auth);

    expect(editada.status).toBe(200);
    expect(editada.body.data.labor[0]).toEqual(expect.objectContaining({ hours: 3, hourlyRate: 120, amount: 360 }));
    expect(editada.body.data.laborSubtotal).toBe(360);
    expect(quitada.body.data.labor).toEqual([]);
    expect(quitada.body.data.laborSubtotal).toBe(0);
  });

  test.each(['TERMINADO', 'ENTREGADO'])('test_no_se_modifica_la_mano_de_obra_en_%s', async (estado) => {
    const { auth, orden } = await mecanicoConOrden(estado);
    const linea = await createOrderLabor(orden.id);

    const alta = await agregarMano(auth, orden.id, { description: 'Extra', hours: 1, hourlyRate: 10 });
    const baja = await request(app).delete(`/api/orders/${orden.id}/labor/${linea.id}`).set('Authorization', auth);

    expect(alta.status).toBe(409);
    expect(baja.status).toBe(409);
  });
});

describe('totales', () => {
  test('test_calcula_subtotales_y_total_de_servicios_y_mano_de_obra', async () => {
    const { auth, orden } = await mecanicoConOrden();
    await agregarServicio(auth, orden.id, { description: 'Balatas', amount: 850.5 });
    await agregarServicio(auth, orden.id, { description: 'Aceite', amount: 349.5 });
    await agregarMano(auth, orden.id, { description: 'Montaje', hours: 2, hourlyRate: 150 });

    const res = await detalle(auth, orden.id);

    expect(res.body.data.servicesSubtotal).toBe(1200);
    expect(res.body.data.laborSubtotal).toBe(300);
    expect(res.body.data.total).toBe(1500);
  });

  test('test_los_totales_aparecen_en_el_listado', async () => {
    const { auth, orden } = await mecanicoConOrden();
    await agregarServicio(auth, orden.id, { description: 'Balatas', amount: 100 });

    const res = await request(app).get('/api/orders').set('Authorization', auth);

    expect(res.body.data[0].total).toBe(100);
  });
});

describe('observaciones y recomendaciones', () => {
  test.each([...ESTADOS_DE_TRABAJO, 'TERMINADO'])('test_edita_observaciones_y_recomendaciones_en_%s', async (estado) => {
    const { auth, orden } = await mecanicoConOrden(estado);

    const res = await trabajo(auth, orden.id, {
      notes: 'Discos con desgaste leve',
      recommendations: 'Revisar en 5,000 km'
    });

    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('Discos con desgaste leve');
    expect(res.body.data.recommendations).toBe('Revisar en 5,000 km');
  });

  test('test_en_terminado_las_notas_se_ajustan_sin_alterar_diagnostico_ni_importes', async () => {
    const { auth, orden } = await mecanicoConOrden('TERMINADO', { diagnosis: 'Original' });
    await createOrderService(orden.id, { amount: 200 });

    const res = await trabajo(auth, orden.id, { recommendations: 'Cambiar llantas pronto' });
    const rechazo = await trabajo(auth, orden.id, { diagnosis: 'Otro', notes: 'No se debe guardar' });

    expect(res.status).toBe(200);
    expect(res.body.data.diagnosis).toBe('Original');
    expect(res.body.data.total).toBe(200);
    expect(rechazo.status).toBe(409);
    expect((await detalle(auth, orden.id)).body.data.notes).toBeNull();
  });

  test('test_en_entregado_cualquier_cambio_se_rechaza', async () => {
    const { auth, orden } = await mecanicoConOrden('ENTREGADO');

    for (const cuerpo of [{ notes: 'x' }, { recommendations: 'x' }, { diagnosis: 'x' }]) {
      const res = await trabajo(auth, orden.id, cuerpo);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_NOT_EDITABLE');
    }
  });

  test('test_vaciar_los_campos_los_deja_en_null_y_respeta_el_limite_de_5000', async () => {
    const { auth, orden } = await mecanicoConOrden('DIAGNOSTICO', { notes: 'Algo', recommendations: 'Otro' });

    const vacio = await trabajo(auth, orden.id, { notes: '', recommendations: '  ' });
    const largo = await trabajo(auth, orden.id, { notes: 'a'.repeat(5001) });

    expect(vacio.body.data.notes).toBeNull();
    expect(vacio.body.data.recommendations).toBeNull();
    expect(largo.status).toBe(400);
    expect(largo.body.error.details.map((d) => d.field)).toContain('notes');
  });
});

describe('permisos del trabajo técnico', () => {
  test('test_el_administrador_puede_documentar_cualquier_orden_abierta', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await createOrder({ status: 'EN_REPARACION' });

    expect((await trabajo(auth, orden.id, { diagnosis: 'Admin' })).status).toBe(200);
    expect((await agregarServicio(auth, orden.id, { description: 'S', amount: 1 })).status).toBe(201);
    expect((await agregarMano(auth, orden.id, { description: 'M', hours: 1, hourlyRate: 1 })).status).toBe(201);
  });

  test('test_la_recepcionista_recibe_403_en_todas_las_operaciones_de_trabajo', async () => {
    const { auth } = await createAuthenticated('RECEPTIONIST');
    const orden = await createOrder({ status: 'EN_REPARACION' });
    const servicio = await createOrderService(orden.id);

    const respuestas = [
      await trabajo(auth, orden.id, { diagnosis: 'x' }),
      await agregarServicio(auth, orden.id, { description: 'S', amount: 1 }),
      await request(app).patch(`/api/orders/${orden.id}/services/${servicio.id}`).set('Authorization', auth).send({ amount: 2 }),
      await request(app).delete(`/api/orders/${orden.id}/services/${servicio.id}`).set('Authorization', auth),
      await agregarMano(auth, orden.id, { description: 'M', hours: 1, hourlyRate: 1 })
    ];

    for (const res of respuestas) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM order_services');
    expect(total).toBe(1);
  });

  test('test_un_mecanico_ajeno_recibe_404_en_todas_las_operaciones', async () => {
    const otro = await createAuthenticated('MECHANIC');
    const duenio = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: duenio.user.id, status: 'EN_REPARACION' });
    const servicio = await createOrderService(orden.id);

    const respuestas = [
      await trabajo(otro.auth, orden.id, { diagnosis: 'x' }),
      await agregarServicio(otro.auth, orden.id, { description: 'S', amount: 1 }),
      await request(app).delete(`/api/orders/${orden.id}/services/${servicio.id}`).set('Authorization', otro.auth),
      await agregarMano(otro.auth, orden.id, { description: 'M', hours: 1, hourlyRate: 1 })
    ];

    for (const res of respuestas) expect(res.status).toBe(404);
  });

  test('test_una_orden_inexistente_responde_404', async () => {
    const { auth } = await createAuthenticated('ADMIN');

    expect((await trabajo(auth, 99999, { diagnosis: 'x' })).status).toBe(404);
    expect((await agregarServicio(auth, 99999, { description: 'S', amount: 1 })).status).toBe(404);
  });

  test('test_exige_sesion', async () => {
    expect((await request(app).patch('/api/orders/1/work').send({ diagnosis: 'x' })).status).toBe(401);
    expect((await request(app).post('/api/orders/1/services').send({})).status).toBe(401);
    expect((await request(app).post('/api/orders/1/labor').send({})).status).toBe(401);
  });
});
