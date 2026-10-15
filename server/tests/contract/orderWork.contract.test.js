// Pruebas de contrato del trabajo técnico de la orden (ver contracts/api.md del Sprint 2).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createOrderLabor, createOrderService } from '../helpers/factories.js';

const app = createApp();

const FORMA_DETALLE = {
  id: expect.any(Number),
  folio: expect.stringMatching(/^OS-\d{6}$/),
  status: expect.any(String),
  diagnosis: null,
  notes: null,
  recommendations: null,
  services: expect.any(Array),
  labor: expect.any(Array),
  servicesSubtotal: expect.any(Number),
  laborSubtotal: expect.any(Number),
  parts: expect.any(Array),
  partsSubtotal: expect.any(Number),
  serviceMileage: null,
  // El mecánico no ve los pagos.
  paymentStatus: null,
  payment: null,
  ticketId: null,
  total: expect.any(Number),
  statusHistory: expect.any(Array),
  allowedTransitions: expect.any(Array),
  editable: {
    work: expect.any(Boolean),
    notesAndRecommendations: expect.any(Boolean),
    parts: expect.any(Boolean),
    basicData: expect.any(Boolean)
  }
};

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato del trabajo técnico', () => {
  test('test_work_responde_200_con_el_detalle_actualizado', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'DIAGNOSTICO' });

    const res = await request(app)
      .patch(`/api/orders/${orden.id}/work`)
      .set('Authorization', mecanico.auth)
      .send({ diagnosis: 'Balatas gastadas' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_DETALLE, diagnosis: 'Balatas gastadas' }));
  });

  test('test_work_acepta_el_kilometraje_de_servicio_y_lo_devuelve_en_el_detalle', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION', entryMileage: 1000 });

    const res = await request(app)
      .patch(`/api/orders/${orden.id}/work`)
      .set('Authorization', mecanico.auth)
      .send({ serviceMileage: 1250 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(expect.objectContaining({ ...FORMA_DETALLE, serviceMileage: 1250 }));
  });

  test('test_work_con_un_kilometraje_de_servicio_menor_al_de_entrada_responde_400_con_el_campo', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION', entryMileage: 1000 });

    const res = await request(app)
      .patch(`/api/orders/${orden.id}/work`)
      .set('Authorization', mecanico.auth)
      .send({ serviceMileage: 999 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('serviceMileage');
  });

  test('test_agregar_un_servicio_responde_201_con_el_detalle_y_los_subtotales', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });

    const res = await request(app)
      .post(`/api/orders/${orden.id}/services`)
      .set('Authorization', mecanico.auth)
      .send({ description: 'Cambio de balatas', amount: 850.5 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining(FORMA_DETALLE));
    expect(res.body.data.services).toEqual([
      { id: expect.any(Number), description: 'Cambio de balatas', amount: 850.5 }
    ]);
    expect(res.body.data.servicesSubtotal).toBe(850.5);
    expect(res.body.data.total).toBe(850.5);
  });

  test('test_agregar_mano_de_obra_responde_201_con_el_importe_calculado', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });

    const res = await request(app)
      .post(`/api/orders/${orden.id}/labor`)
      .set('Authorization', mecanico.auth)
      .send({ description: 'Montaje', hours: 2.5, hourlyRate: 150 });

    expect(res.status).toBe(201);
    expect(res.body.data.labor).toEqual([
      { id: expect.any(Number), description: 'Montaje', hours: 2.5, hourlyRate: 150, amount: 375 }
    ]);
    expect(res.body.data.laborSubtotal).toBe(375);
  });

  test('test_editar_y_quitar_lineas_responden_200_con_el_detalle', async () => {
    const admin = await createAuthenticated('ADMIN');
    const orden = await createOrder({ status: 'EN_REPARACION' });
    const servicio = await createOrderService(orden.id, { amount: 100 });
    const mano = await createOrderLabor(orden.id, { hours: 1, hourlyRate: 100 });

    const editado = await request(app)
      .patch(`/api/orders/${orden.id}/services/${servicio.id}`)
      .set('Authorization', admin.auth)
      .send({ amount: 120 });
    const quitado = await request(app)
      .delete(`/api/orders/${orden.id}/labor/${mano.id}`)
      .set('Authorization', admin.auth);

    expect(editado.status).toBe(200);
    expect(editado.body.data.servicesSubtotal).toBe(120);
    expect(quitado.status).toBe(200);
    expect(quitado.body.data.labor).toEqual([]);
  });

  test('test_los_errores_usan_el_formato_del_contrato', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'TERMINADO' });

    const invalido = await request(app)
      .post(`/api/orders/${orden.id}/services`)
      .set('Authorization', mecanico.auth)
      .send({ description: '', amount: -1 });
    const noEditable = await request(app)
      .post(`/api/orders/${orden.id}/services`)
      .set('Authorization', mecanico.auth)
      .send({ description: 'Extra', amount: 10 });

    expect(invalido.status).toBe(400);
    expect(invalido.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['description', 'amount'])
    );
    expect(noEditable.status).toBe(409);
    expect(noEditable.body).toEqual({
      error: { code: 'ORDER_NOT_EDITABLE', message: expect.any(String), details: { status: 'TERMINADO' } }
    });
  });
});
