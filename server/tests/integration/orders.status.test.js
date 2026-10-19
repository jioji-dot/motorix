import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearCita,
  crearClienteConVehiculo,
  crearOrden,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let mecanico2;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const comoMecanico2 = () => ({ Authorization: `Bearer ${mecanico2.token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  mecanico2 = await crearSegundoMecanico();
  datos = await crearClienteConVehiculo();
});

afterAll(cerrarConexiones);

const nuevaOrden = (status = 'RECIBIDO', extra = {}) =>
  crearOrden({ ...datos, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, status, ...extra });

const cambiar = (id, status, rol = 'MECHANIC', extra = {}) =>
  request(app).post(`/api/orders/${id}/status`).set(como(rol)).send({ status, ...extra });

describe('Flujo completo por rol (integración)', () => {
  test('recorre_RECIBIDO_a_ENTREGADO_con_historial_validaciones_y_efectos_sobre_la_cita', async () => {
    const citaId = await crearCita({ ...datos, createdBy: usuarios.ADMIN.id, status: 'CONFIRMADA', dias: 3 });
    const creada = await request(app).post('/api/orders').set(como('RECEPTIONIST')).send({
      clientId: datos.clientId,
      vehicleId: datos.vehicleId,
      mechanicId: usuarios.MECHANIC.id,
      entryMileage: 50000,
      appointmentId: citaId,
    });
    expect(creada.status).toBe(201);
    const id = creada.body.data.id;
    expect(creada.body.data.allowedTransitions).toEqual(['CANCELADA']); // recepción solo puede cancelar

    // El mecánico asignado avanza el trabajo.
    expect((await cambiar(id, 'DIAGNOSTICO')).body.data.status).toBe('DIAGNOSTICO');
    expect((await cambiar(id, 'EN_REPARACION')).body.data.status).toBe('EN_REPARACION');

    // No puede terminar sin diagnóstico ni servicios.
    const incompleta = await cambiar(id, 'TERMINADO');
    expect(incompleta.status).toBe(409);
    expect(incompleta.body.error.code).toBe('ORDER_INCOMPLETE');
    expect(incompleta.body.error.message).toMatch(/diagnóstico/);

    await request(app).patch(`/api/orders/${id}`).set(como('MECHANIC')).send({ diagnosis: 'Cambio de balatas' });
    expect((await cambiar(id, 'TERMINADO')).body.error.message).toMatch(/servicio o mano de obra/);
    await request(app).post(`/api/orders/${id}/services`).set(como('MECHANIC')).send({ description: 'Balatas', amount: 900 });

    const terminada = await cambiar(id, 'TERMINADO');
    expect(terminada.status).toBe(200);
    expect(terminada.body.data.status).toBe('TERMINADO');
    expect(terminada.body.data.allowedTransitions).toEqual([]); // el mecánico ya no puede hacer nada

    // El mecánico no entrega; recepción sí.
    const noEntrega = await cambiar(id, 'ENTREGADO', 'MECHANIC');
    expect(noEntrega.status).toBe(403);
    const entregada = await cambiar(id, 'ENTREGADO', 'RECEPTIONIST');
    expect(entregada.status).toBe(200);
    expect(entregada.body.data.status).toBe('ENTREGADO');
    expect(entregada.body.data.deliveredAt).toEqual(expect.any(String));

    // Historial completo con quién y cuándo.
    const historial = entregada.body.data.history;
    expect(historial.map((h) => h.toStatus)).toEqual(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO']);
    expect(historial[1]).toMatchObject({ fromStatus: 'RECIBIDO', changedBy: { id: usuarios.MECHANIC.id } });
    expect(historial[4].changedBy.id).toBe(usuarios.RECEPTIONIST.id);

    // La cita queda completada y la orden entregada ya no cambia ni se edita.
    const cita = await request(app).get(`/api/appointments/${citaId}`).set(como('ADMIN'));
    expect(cita.body.data.status).toBe('COMPLETADA');
    for (const destino of ['DIAGNOSTICO', 'CANCELADA', 'ENTREGADO']) {
      const respuesta = await cambiar(id, destino, 'ADMIN', { reason: 'x' });
      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.code).toBe('INVALID_TRANSITION');
    }
    expect((await request(app).post(`/api/orders/${id}/services`).set(como('MECHANIC')).send({ description: 'x', amount: 1 })).status).toBe(409);
  });

  test('rechaza_los_saltos_indicando_las_transiciones_permitidas', async () => {
    const id = await nuevaOrden('DIAGNOSTICO');
    const respuesta = await cambiar(id, 'TERMINADO');
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('INVALID_TRANSITION');
    expect(respuesta.body.error.details).toEqual(['EN_REPARACION']);
    expect((await cambiar(id, 'RECIBIDO')).status).toBe(409); // tampoco hay retrocesos
    expect((await cambiar(id, 'DIAGNOSTICO')).status).toBe(409); // ni al mismo estado
  });

  test('ESPERANDO_REFACCION_es_un_desvio_permitido_desde_EN_REPARACION_y_regresa', async () => {
    const id = await nuevaOrden('EN_REPARACION');
    expect((await cambiar(id, 'ESPERANDO_REFACCION')).body.data.status).toBe('ESPERANDO_REFACCION');
    expect((await cambiar(id, 'TERMINADO')).status).toBe(409); // no se termina esperando refacción
    expect((await cambiar(id, 'EN_REPARACION')).body.data.status).toBe('EN_REPARACION');
  });

  test('otro_mecanico_recibe_403_y_el_administrador_puede_avanzar_cualquier_orden', async () => {
    const id = await nuevaOrden('RECIBIDO');
    expect((await request(app).post(`/api/orders/${id}/status`).set(comoMecanico2()).send({ status: 'DIAGNOSTICO' })).status).toBe(403);
    expect((await cambiar(id, 'DIAGNOSTICO', 'ADMIN')).status).toBe(200);
  });

  test('allowedTransitions_depende_del_rol_en_el_detalle', async () => {
    const id = await nuevaOrden('EN_REPARACION');
    const del = async (rol) => (await request(app).get(`/api/orders/${id}`).set(como(rol))).body.data.allowedTransitions.sort();
    expect(await del('MECHANIC')).toEqual(['ESPERANDO_REFACCION', 'TERMINADO']);
    expect(await del('RECEPTIONIST')).toEqual(['CANCELADA']);
    expect(await del('ADMIN')).toEqual(['CANCELADA', 'ESPERANDO_REFACCION', 'TERMINADO']);
  });
});

describe('Cancelación (integración)', () => {
  test('recepcion_cancela_con_motivo_conserva_todo_y_la_cita_vuelve_a_confirmada', async () => {
    const citaId = await crearCita({ ...datos, createdBy: usuarios.ADMIN.id, status: 'EN_PROCESO', dias: 4 });
    const id = await nuevaOrden('EN_REPARACION', { appointmentId: citaId });
    await request(app).post(`/api/orders/${id}/services`).set(como('MECHANIC')).send({ description: 'Parcial', amount: 100 });

    const sinMotivo = await cambiar(id, 'CANCELADA', 'RECEPTIONIST');
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.details[0].field).toBe('reason');

    const mecanico = await cambiar(id, 'CANCELADA', 'MECHANIC', { reason: 'Intento' });
    expect(mecanico.status).toBe(403);

    const cancelada = await cambiar(id, 'CANCELADA', 'RECEPTIONIST', { reason: 'El cliente se llevó el vehículo' });
    expect(cancelada.status).toBe(200);
    expect(cancelada.body.data).toMatchObject({ status: 'CANCELADA', cancellationReason: 'El cliente se llevó el vehículo', total: '100.00' });
    expect(cancelada.body.data.services).toHaveLength(1);
    expect(cancelada.body.data.history.at(-1)).toMatchObject({ toStatus: 'CANCELADA', reason: 'El cliente se llevó el vehículo' });

    // La cita vuelve a Confirmada: ya puede reutilizarse o cancelarse.
    const cita = await request(app).get(`/api/appointments/${citaId}`).set(como('ADMIN'));
    expect(cita.body.data).toMatchObject({ status: 'CONFIRMADA', orderId: null });
    expect((await request(app).post(`/api/appointments/${citaId}/cancel`).set(como('RECEPTIONIST'))).status).toBe(200);
  });

  test('una_cita_con_orden_cancelada_admite_una_orden_nueva', async () => {
    const citaId = await crearCita({ ...datos, createdBy: usuarios.ADMIN.id, status: 'EN_PROCESO', dias: 5 });
    const primera = await nuevaOrden('RECIBIDO', { appointmentId: citaId });
    await cambiar(primera, 'CANCELADA', 'RECEPTIONIST', { reason: 'Error de captura' });

    const segunda = await request(app).post('/api/orders').set(como('RECEPTIONIST')).send({
      clientId: datos.clientId,
      vehicleId: datos.vehicleId,
      mechanicId: usuarios.MECHANIC.id,
      entryMileage: 60000,
      appointmentId: citaId,
    });
    expect(segunda.status).toBe(201);
  });

  test.each(['TERMINADO', 'ENTREGADO', 'CANCELADA'])('no_se_cancela_una_orden_%s', async (status) => {
    const id = await nuevaOrden(status);
    const respuesta = await cambiar(id, 'CANCELADA', 'ADMIN', { reason: 'x' });
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('Cambios simultáneos (integración)', () => {
  test('con_expectedStatus_solo_uno_gana_y_el_otro_recibe_STATE_CONFLICT', async () => {
    const id = await nuevaOrden('RECIBIDO');
    const peticion = () =>
      request(app).post(`/api/orders/${id}/status`).set(como('MECHANIC')).send({ status: 'DIAGNOSTICO', expectedStatus: 'RECIBIDO' });
    const [a, b] = await Promise.all([peticion(), peticion()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const perdedora = a.status === 409 ? a : b;
    expect(perdedora.body.error.code).toBe('STATE_CONFLICT');

    const [[fila]] = await pool.query('SELECT COUNT(*) AS n FROM order_status_history WHERE orderId = ? AND toStatus = ?', [id, 'DIAGNOSTICO']);
    expect(fila.n).toBe(1); // una sola transición quedó registrada
  });

  test('sin_expectedStatus_el_segundo_cambio_simultaneo_se_rechaza_como_transicion_invalida', async () => {
    const id = await nuevaOrden('RECIBIDO');
    const peticion = () => request(app).post(`/api/orders/${id}/status`).set(como('MECHANIC')).send({ status: 'DIAGNOSTICO' });
    const [a, b] = await Promise.all([peticion(), peticion()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [[fila]] = await pool.query('SELECT status FROM service_orders WHERE id = ?', [id]);
    expect(fila.status).toBe('DIAGNOSTICO');
  });
});

describe('Validaciones del cambio de estado', () => {
  test('rechaza_estados_invalidos_ordenes_inexistentes_y_peticiones_sin_token', async () => {
    const id = await nuevaOrden();
    expect((await cambiar(id, 'OTRO')).status).toBe(400);
    expect((await cambiar(999999, 'DIAGNOSTICO', 'ADMIN')).status).toBe(404);
    expect((await request(app).post(`/api/orders/${id}/status`).send({ status: 'DIAGNOSTICO' })).status).toBe(401);
  });
});
