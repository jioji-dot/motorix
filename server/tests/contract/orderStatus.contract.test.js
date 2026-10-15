// Pruebas de contrato de POST /api/orders/:id/status (ver contracts/api.md del Sprint 2).
import request from 'supertest';
import { createApp } from '../../app.js';
import { cleanTables, closePool } from '../helpers/testDb.js';
import { createAuthenticated, createOrder, createOrderService } from '../helpers/factories.js';

const app = createApp();

const cambiar = (auth, id, status) =>
  request(app).post(`/api/orders/${id}/status`).set('Authorization', auth).send({ status });

beforeEach(cleanTables);
afterAll(closePool);

describe('contrato del cambio de estado', () => {
  test('test_responde_200_con_el_detalle_de_la_orden_y_su_historial', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id });

    const res = await cambiar(mecanico.auth, orden.id, 'DIAGNOSTICO');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: orden.id,
        status: 'DIAGNOSTICO',
        allowedTransitions: ['EN_REPARACION'],
        statusHistory: [
          expect.objectContaining({ fromStatus: null, toStatus: 'RECIBIDO' }),
          {
            fromStatus: 'RECIBIDO',
            toStatus: 'DIAGNOSTICO',
            changedBy: { id: mecanico.user.id, name: mecanico.user.name },
            createdAt: expect.any(String)
          }
        ]
      })
    );
  });

  test('test_una_transicion_invalida_responde_409_con_los_estados_validos', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'DIAGNOSTICO' });

    const res = await cambiar(mecanico.auth, orden.id, 'TERMINADO');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'INVALID_TRANSITION',
        message: expect.stringContaining('EN_REPARACION'),
        details: { from: 'DIAGNOSTICO', to: 'TERMINADO', allowed: ['EN_REPARACION'] }
      }
    });
  });

  test('test_sin_mecanico_responde_409_mechanic_required', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await createOrder({ status: 'RECIBIDO', mechanicId: null });

    const res = await cambiar(auth, orden.id, 'DIAGNOSTICO');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MECHANIC_REQUIRED');
  });

  test('test_terminar_sin_lo_requerido_responde_409_con_lo_que_falta', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({ mechanicId: mecanico.user.id, status: 'EN_REPARACION' });

    const res = await cambiar(mecanico.auth, orden.id, 'TERMINADO');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_INCOMPLETE');
    expect(res.body.error.details).toEqual({ missing: ['diagnosis', 'servicesOrLabor'] });
  });

  test('test_un_estado_desconocido_responde_400', async () => {
    const { auth } = await createAuthenticated('ADMIN');
    const orden = await createOrder();

    const res = await cambiar(auth, orden.id, 'CANCELADO');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toContain('status');
  });

  test('test_terminar_con_lo_requerido_responde_200', async () => {
    const mecanico = await createAuthenticated('MECHANIC');
    const orden = await createOrder({
      mechanicId: mecanico.user.id,
      status: 'EN_REPARACION',
      diagnosis: 'Balatas gastadas'
    });
    await createOrderService(orden.id);

    const res = await cambiar(mecanico.auth, orden.id, 'TERMINADO');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('TERMINADO');
  });
});
