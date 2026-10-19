// Contrato de POST /api/orders/:id/status (specs/002-citas-ordenes-servicio/contracts/api.md).
import request from 'supertest';
import { app } from '../../app.js';
import { cerrarConexiones, crearClienteConVehiculo, crearOrden, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

const nuevaOrden = (status = 'RECIBIDO', extra = {}) =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status, ...extra });

const enviar = (id, cuerpo, rol = 'MECHANIC') => request(app).post(`/api/orders/${id}/status`).set(como(rol)).send(cuerpo);

describe('POST /api/orders/:id/status', () => {
  test('responde_200_con_la_orden_completa_el_nuevo_estado_y_las_transiciones_del_usuario', async () => {
    const id = await nuevaOrden('RECIBIDO');
    const respuesta = await enviar(id, { status: 'DIAGNOSTICO' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id,
      status: 'DIAGNOSTICO',
      allowedTransitions: ['EN_REPARACION'],
      history: [
        { fromStatus: null, toStatus: 'RECIBIDO' },
        { fromStatus: 'RECIBIDO', toStatus: 'DIAGNOSTICO', changedBy: { id: usuarios.MECHANIC.id, name: 'Mecánico de prueba' }, reason: null },
      ],
    });
    expect(respuesta.body.data.history[1].changedAt).toEqual(expect.any(String));
  });

  test('responde_400_cuando_falta_el_motivo_al_cancelar_con_el_campo_en_details', async () => {
    const id = await nuevaOrden('RECIBIDO');
    const respuesta = await enviar(id, { status: 'CANCELADA' }, 'RECEPTIONIST');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: [{ field: 'reason', message: 'Indica el motivo de la cancelación.' }],
      },
    });
  });

  test('responde_403_FORBIDDEN_cuando_el_rol_no_puede_aplicar_ese_cambio', async () => {
    const id = await nuevaOrden('TERMINADO');
    const respuesta = await enviar(id, { status: 'ENTREGADO' }, 'MECHANIC');
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  test('responde_409_INVALID_TRANSITION_con_las_permitidas_en_details', async () => {
    const id = await nuevaOrden('RECIBIDO');
    const respuesta = await enviar(id, { status: 'ENTREGADO' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({
      error: { code: 'INVALID_TRANSITION', message: expect.any(String), details: ['DIAGNOSTICO'] },
    });
  });

  test('responde_409_ORDER_INCOMPLETE_al_terminar_sin_diagnostico_ni_lineas', async () => {
    const id = await nuevaOrden('EN_REPARACION');
    const respuesta = await enviar(id, { status: 'TERMINADO' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: { code: 'ORDER_INCOMPLETE', message: expect.any(String) } });
  });

  test('responde_409_STATE_CONFLICT_cuando_el_estado_esperado_ya_no_coincide', async () => {
    const id = await nuevaOrden('DIAGNOSTICO');
    const respuesta = await enviar(id, { status: 'EN_REPARACION', expectedStatus: 'RECIBIDO' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body).toEqual({ error: { code: 'STATE_CONFLICT', message: expect.any(String) } });
  });

  test('responde_404_si_la_orden_no_existe_y_400_si_el_estado_no_es_valido', async () => {
    expect((await enviar(987654, { status: 'DIAGNOSTICO' }, 'ADMIN')).status).toBe(404);
    const invalido = await enviar(await nuevaOrden(), { status: 'VOLANDO' });
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.details[0].field).toBe('status');
  });
});
