import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearCita,
  crearClienteConVehiculo,
  crearOrden,
  crearUsuariosDePrueba,
  fechaLocal,
  limpiarBase,
} from '../helpers.js';

let usuarios;
let datos;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  datos = await crearClienteConVehiculo({ nombre: 'Cliente de citas' });
});

afterAll(cerrarConexiones);

const crear = (cuerpo, rol = 'RECEPTIONIST') =>
  request(app).post('/api/appointments').set(como(rol)).send({ clientId: datos.clientId, vehicleId: datos.vehicleId, ...cuerpo });

describe('Citas (integración)', () => {
  test('el_mecanico_recibe_403_en_todas_las_rutas_de_citas', async () => {
    const id = await crearCita({ ...datos, createdBy: usuarios.ADMIN.id, dias: 20 });
    expect((await request(app).get('/api/appointments').set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).get(`/api/appointments/${id}`).set(como('MECHANIC'))).status).toBe(403);
    expect((await crear({ scheduledAt: fechaLocal(3), reason: 'No debe crearse' }, 'MECHANIC')).status).toBe(403);
    expect((await request(app).patch(`/api/appointments/${id}`).set(como('MECHANIC')).send({ reason: 'x' })).status).toBe(403);
    expect((await request(app).post(`/api/appointments/${id}/confirm`).set(como('MECHANIC'))).status).toBe(403);
    expect((await request(app).post(`/api/appointments/${id}/cancel`).set(como('MECHANIC'))).status).toBe(403);
  });

  test('rechaza_peticiones_sin_token', async () => {
    expect((await request(app).get('/api/appointments')).status).toBe(401);
  });

  test.each(['ADMIN', 'RECEPTIONIST'])('el_rol_%s_agenda_una_cita_que_queda_pendiente', async (rol) => {
    const respuesta = await crear({ scheduledAt: fechaLocal(rol === 'ADMIN' ? 4 : 5, '09:00'), reason: `Cita de ${rol}` }, rol);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ status: 'PENDIENTE', reason: `Cita de ${rol}`, orderId: null });
    expect(respuesta.body.data.client.name).toBe('Cliente de citas');
  });

  test('rechaza_un_vehiculo_de_otro_cliente', async () => {
    const otro = await crearClienteConVehiculo({ nombre: 'Otro dueño' });
    const respuesta = await request(app)
      .post('/api/appointments')
      .set(como('RECEPTIONIST'))
      .send({ clientId: datos.clientId, vehicleId: otro.vehicleId, scheduledAt: fechaLocal(6), reason: 'Mal asociada' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.details).toEqual([{ field: 'vehicleId', message: expect.stringMatching(/no pertenece/) }]);
  });

  test('rechaza_fechas_pasadas_y_clientes_desactivados', async () => {
    const pasada = await crear({ scheduledAt: fechaLocal(-1), reason: 'Ayer' });
    expect(pasada.status).toBe(400);
    expect(pasada.body.error.details[0].field).toBe('scheduledAt');

    const inactivo = await crearClienteConVehiculo({ nombre: 'Cliente inactivo' });
    await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [inactivo.clientId]);
    const rechazada = await request(app)
      .post('/api/appointments')
      .set(como('RECEPTIONIST'))
      .send({ clientId: inactivo.clientId, vehicleId: inactivo.vehicleId, scheduledAt: fechaLocal(2), reason: 'No' });
    expect(rechazada.status).toBe(400);
    expect(rechazada.body.error.details[0].field).toBe('clientId');
  });

  test('avisa_de_una_cita_duplicada_y_la_acepta_al_confirmar', async () => {
    const cuerpo = { scheduledAt: fechaLocal(7, '11:30'), reason: 'Primera' };
    expect((await crear(cuerpo)).status).toBe(201);

    const aviso = await crear({ ...cuerpo, reason: 'Segunda' });
    expect(aviso.status).toBe(409);
    expect(aviso.body.error.code).toBe('DUPLICATE_APPOINTMENT');

    const confirmada = await crear({ ...cuerpo, reason: 'Segunda', confirmDuplicate: true });
    expect(confirmada.status).toBe(201);
  });

  test('filtra_por_fecha_estado_y_busca_por_cliente_o_placas_ordenando_por_fecha', async () => {
    const lejano = await crearClienteConVehiculo({ nombre: 'Cliente Filtro' });
    await crearCita({ ...lejano, createdBy: usuarios.ADMIN.id, dias: 40, hora: '15:00', status: 'CONFIRMADA' });
    await crearCita({ ...lejano, createdBy: usuarios.ADMIN.id, dias: 40, hora: '08:00', status: 'PENDIENTE' });
    await crearCita({ ...lejano, createdBy: usuarios.ADMIN.id, dias: 41, hora: '08:00', status: 'PENDIENTE' });
    const dia = fechaLocal(40).slice(0, 10);

    const porFecha = await request(app).get(`/api/appointments?from=${dia}&to=${dia}`).set(como('RECEPTIONIST'));
    expect(porFecha.status).toBe(200);
    expect(porFecha.body.data).toHaveLength(2);
    const horas = porFecha.body.data.map((c) => new Date(c.scheduledAt).getHours());
    expect(horas).toEqual([8, 15]);

    const porEstado = await request(app).get(`/api/appointments?from=${dia}&to=${dia}&status=CONFIRMADA`).set(como('ADMIN'));
    expect(porEstado.body.data).toHaveLength(1);

    const porNombre = await request(app).get('/api/appointments?search=Filtro').set(como('ADMIN'));
    expect(porNombre.body.meta.total).toBe(3);
    const porPlacas = await request(app).get(`/api/appointments?search=${lejano.licensePlate}`).set(como('ADMIN'));
    expect(porPlacas.body.meta.total).toBe(3);
  });

  test('confirma_modifica_y_cancela_conservando_la_cita_como_historial', async () => {
    const alta = await crear({ scheduledAt: fechaLocal(10, '12:00'), reason: 'Para cancelar' });
    const id = alta.body.data.id;

    const confirmada = await request(app).post(`/api/appointments/${id}/confirm`).set(como('RECEPTIONIST'));
    expect(confirmada.body.data.status).toBe('CONFIRMADA');

    const movida = await request(app)
      .patch(`/api/appointments/${id}`)
      .set(como('RECEPTIONIST'))
      .send({ scheduledAt: fechaLocal(10, '16:45'), reason: 'Motivo actualizado' });
    expect(movida.status).toBe(200);
    expect(new Date(movida.body.data.scheduledAt).getHours()).toBe(16);
    expect(movida.body.data.reason).toBe('Motivo actualizado');

    const cancelada = await request(app).post(`/api/appointments/${id}/cancel`).set(como('RECEPTIONIST'));
    expect(cancelada.status).toBe(200);
    expect(cancelada.body.data.status).toBe('CANCELADA');

    // Sigue en el historial y ya no se puede modificar ni cancelar de nuevo.
    expect((await request(app).get(`/api/appointments/${id}`).set(como('ADMIN'))).body.data.status).toBe('CANCELADA');
    expect((await request(app).patch(`/api/appointments/${id}`).set(como('ADMIN')).send({ reason: 'x' })).body.error.code).toBe('APPOINTMENT_NOT_EDITABLE');
    expect((await request(app).post(`/api/appointments/${id}/cancel`).set(como('ADMIN'))).status).toBe(409);
  });

  test('no_se_puede_cancelar_una_cita_que_tiene_una_orden_activa', async () => {
    const otro = await crearClienteConVehiculo({ nombre: 'Cliente con orden' });
    const citaId = await crearCita({ ...otro, createdBy: usuarios.ADMIN.id, status: 'EN_PROCESO', dias: 12 });
    await crearOrden({ ...otro, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.ADMIN.id, appointmentId: citaId });

    const respuesta = await request(app).post(`/api/appointments/${citaId}/cancel`).set(como('RECEPTIONIST'));
    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe('APPOINTMENT_HAS_ORDER');

    const detalle = await request(app).get(`/api/appointments/${citaId}`).set(como('RECEPTIONIST'));
    expect(detalle.body.data.orderId).toEqual(expect.any(Number));
  });

  test('devuelve_404_para_una_cita_inexistente_y_400_para_un_id_invalido', async () => {
    expect((await request(app).get('/api/appointments/999999').set(como('ADMIN'))).status).toBe(404);
    expect((await request(app).get('/api/appointments/abc').set(como('ADMIN'))).status).toBe(400);
    expect((await request(app).get('/api/appointments?from=2030-99-99').set(como('ADMIN'))).status).toBe(400);
  });
});
