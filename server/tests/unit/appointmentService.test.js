import { jest } from '@jest/globals';
import { createAppointmentService } from '../../services/appointmentService.js';
import { createAppointmentSchema, updateAppointmentSchema } from '../../validators/appointmentValidator.js';

const AHORA = new Date('2030-03-10T12:30:45');
const FUTURA = '2030-03-12T09:00';

const BASE = { clientId: 1, vehicleId: 7, scheduledAt: FUTURA, reason: 'Cambio de aceite' };

function crearEntorno({ cita = null, cliente = { id: 1, name: 'Ana', active: true }, vehiculo = { id: 7, clientId: 1 }, duplicada = null, ordenActiva = false } = {}) {
  const appointmentModel = {
    findById: jest.fn(async () => cita),
    findDuplicate: jest.fn(async () => duplicada),
    hasActiveOrder: jest.fn(async () => ordenActiva),
    create: jest.fn(async (datos) => ({ id: 30, status: 'PENDIENTE', ...datos })),
    update: jest.fn(async (id, datos) => ({ ...cita, ...datos })),
    setStatus: jest.fn(async (id, status) => ({ ...cita, status })),
    list: jest.fn(),
  };
  const clientModel = { findById: jest.fn(async () => cliente) };
  const vehicleModel = { findById: jest.fn(async () => vehiculo) };
  const servicio = createAppointmentService({ appointmentModel, clientModel, vehicleModel, now: () => AHORA });
  return { servicio, appointmentModel };
}

const analizar = (datos) => createAppointmentSchema.parse(datos);

describe('Validación de citas', () => {
  test('acepta_una_cita_valida_y_convierte_la_fecha_a_hora_local', () => {
    const cita = analizar(BASE);
    expect(cita.scheduledAt).toBeInstanceOf(Date);
    expect(cita.scheduledAt.getHours()).toBe(9);
    expect(cita.notes).toBeUndefined();
  });

  test('el_motivo_es_obligatorio_y_tiene_de_1_a_255_caracteres', () => {
    expect(createAppointmentSchema.safeParse({ ...BASE, reason: '   ' }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...BASE, reason: 'a'.repeat(256) }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...BASE, reason: 'a'.repeat(255) }).success).toBe(true);
  });

  test('las_observaciones_admiten_hasta_2000_caracteres_y_vacias_se_guardan_como_nulas', () => {
    expect(createAppointmentSchema.safeParse({ ...BASE, notes: 'a'.repeat(2001) }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...BASE, notes: 'a'.repeat(2000) }).success).toBe(true);
    expect(analizar({ ...BASE, notes: '  ' }).notes).toBeNull();
  });

  test('exige_cliente_vehiculo_y_fecha_con_mensajes_en_espanol', () => {
    const resultado = createAppointmentSchema.safeParse({ reason: 'x' });
    const mensajes = Object.fromEntries(resultado.error.issues.map((i) => [i.path[0], i.message]));
    expect(mensajes.clientId).toBe('El cliente es obligatorio.');
    expect(mensajes.vehicleId).toBe('El vehículo es obligatorio.');
    expect(mensajes.scheduledAt).toBe('La fecha y hora son obligatorias.');
  });

  test('rechaza_fechas_con_formato_invalido', () => {
    expect(createAppointmentSchema.safeParse({ ...BASE, scheduledAt: '12/03/2030 09:00' }).success).toBe(false);
    expect(createAppointmentSchema.safeParse({ ...BASE, scheduledAt: '2030-13-45T99:99' }).success).toBe(false);
  });

  test('la_edicion_exige_al_menos_un_campo', () => {
    expect(updateAppointmentSchema.safeParse({}).success).toBe(false);
    expect(updateAppointmentSchema.safeParse({ confirmDuplicate: true }).success).toBe(false);
    expect(updateAppointmentSchema.safeParse({ reason: 'Otro motivo' }).success).toBe(true);
  });
});

describe('appointmentService.create', () => {
  test('crea_la_cita_en_estado_pendiente_registrando_quien_la_creo', async () => {
    const { servicio, appointmentModel } = crearEntorno();
    const creada = await servicio.create(analizar(BASE), { id: 2 });
    expect(appointmentModel.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: 1, vehicleId: 7, createdBy: 2 }));
    expect(creada.status).toBe('PENDIENTE');
  });

  test('rechaza_un_cliente_inexistente_con_404', async () => {
    const { servicio } = crearEntorno({ cliente: null });
    await expect(servicio.create(analizar(BASE), { id: 2 })).rejects.toMatchObject({ status: 404 });
  });

  test('rechaza_un_cliente_desactivado', async () => {
    const { servicio } = crearEntorno({ cliente: { id: 1, active: false } });
    const error = await servicio.create(analizar(BASE), { id: 2 }).catch((e) => e);
    expect(error.status).toBe(400);
    expect(error.details).toEqual([{ field: 'clientId', message: expect.stringMatching(/desactivado/) }]);
  });

  test('rechaza_un_vehiculo_inexistente_con_404', async () => {
    const { servicio } = crearEntorno({ vehiculo: null });
    await expect(servicio.create(analizar(BASE), { id: 2 })).rejects.toMatchObject({ status: 404 });
  });

  test('rechaza_un_vehiculo_que_no_pertenece_al_cliente', async () => {
    const { servicio, appointmentModel } = crearEntorno({ vehiculo: { id: 7, clientId: 99 } });
    const error = await servicio.create(analizar(BASE), { id: 2 }).catch((e) => e);
    expect(error.status).toBe(400);
    expect(error.details).toEqual([{ field: 'vehicleId', message: 'El vehículo no pertenece al cliente seleccionado.' }]);
    expect(appointmentModel.create).not.toHaveBeenCalled();
  });

  test('rechaza_fechas_pasadas_pero_acepta_el_minuto_en_curso', async () => {
    const { servicio } = crearEntorno();
    const pasada = await servicio.create(analizar({ ...BASE, scheduledAt: '2030-03-10T12:29' }), { id: 2 }).catch((e) => e);
    expect(pasada.details).toEqual([{ field: 'scheduledAt', message: expect.stringMatching(/pasado/) }]);
    await expect(servicio.create(analizar({ ...BASE, scheduledAt: '2030-03-10T12:30' }), { id: 2 })).resolves.toBeDefined();
  });

  test('avisa_con_409_si_hay_otra_cita_activa_del_mismo_vehiculo_a_esa_hora', async () => {
    const { servicio, appointmentModel } = crearEntorno({ duplicada: { id: 5, status: 'CONFIRMADA' } });
    const error = await servicio.create(analizar(BASE), { id: 2 }).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('DUPLICATE_APPOINTMENT');
    expect(appointmentModel.create).not.toHaveBeenCalled();
  });

  test('guarda_la_cita_duplicada_cuando_se_confirma', async () => {
    const { servicio, appointmentModel } = crearEntorno({ duplicada: { id: 5, status: 'CONFIRMADA' } });
    await servicio.create(analizar({ ...BASE, confirmDuplicate: true }), { id: 2 });
    expect(appointmentModel.create).toHaveBeenCalledTimes(1);
    expect(appointmentModel.create.mock.calls[0][0]).not.toHaveProperty('confirmDuplicate');
  });
});

describe('appointmentService.confirm', () => {
  test('confirma_solo_desde_pendiente', async () => {
    const { servicio, appointmentModel } = crearEntorno({ cita: { id: 4, status: 'PENDIENTE' } });
    await servicio.confirm(4);
    expect(appointmentModel.setStatus).toHaveBeenCalledWith(4, 'CONFIRMADA');
  });

  test.each(['CONFIRMADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'])('rechaza_confirmar_una_cita_%s', async (status) => {
    const { servicio } = crearEntorno({ cita: { id: 4, status } });
    await expect(servicio.confirm(4)).rejects.toMatchObject({ status: 409, code: 'APPOINTMENT_NOT_EDITABLE' });
  });
});

describe('appointmentService.cancel', () => {
  test.each(['PENDIENTE', 'CONFIRMADA'])('cancela_una_cita_%s_sin_orden_activa', async (status) => {
    const { servicio, appointmentModel } = crearEntorno({ cita: { id: 4, status } });
    await servicio.cancel(4);
    expect(appointmentModel.setStatus).toHaveBeenCalledWith(4, 'CANCELADA');
  });

  test('rechaza_cancelar_una_cita_con_orden_activa', async () => {
    const { servicio, appointmentModel } = crearEntorno({ cita: { id: 4, status: 'EN_PROCESO' }, ordenActiva: true });
    await expect(servicio.cancel(4)).rejects.toMatchObject({ status: 409, code: 'APPOINTMENT_HAS_ORDER' });
    expect(appointmentModel.setStatus).not.toHaveBeenCalled();
  });

  test.each(['COMPLETADA', 'CANCELADA'])('rechaza_cancelar_una_cita_%s', async (status) => {
    const { servicio } = crearEntorno({ cita: { id: 4, status } });
    await expect(servicio.cancel(4)).rejects.toMatchObject({ status: 409, code: 'APPOINTMENT_NOT_EDITABLE' });
  });

  test('devuelve_404_si_la_cita_no_existe', async () => {
    const { servicio } = crearEntorno({ cita: null });
    await expect(servicio.cancel(4)).rejects.toMatchObject({ status: 404 });
  });
});

describe('appointmentService.update', () => {
  const cita = { id: 4, vehicleId: 7, status: 'CONFIRMADA', scheduledAt: new Date('2030-03-15T10:00:00') };

  test.each(['PENDIENTE', 'CONFIRMADA'])('permite_editar_una_cita_%s', async (status) => {
    const { servicio, appointmentModel } = crearEntorno({ cita: { ...cita, status } });
    await servicio.update(4, { reason: 'Nuevo motivo' });
    expect(appointmentModel.update).toHaveBeenCalledWith(4, { reason: 'Nuevo motivo' });
  });

  test.each(['EN_PROCESO', 'COMPLETADA', 'CANCELADA'])('rechaza_editar_una_cita_%s', async (status) => {
    const { servicio } = crearEntorno({ cita: { ...cita, status } });
    await expect(servicio.update(4, { reason: 'x' })).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_EDITABLE' });
  });

  test('rechaza_cambiar_la_fecha_a_una_pasada', async () => {
    const { servicio } = crearEntorno({ cita });
    const error = await servicio.update(4, { scheduledAt: new Date('2030-03-09T10:00:00') }).catch((e) => e);
    expect(error.status).toBe(400);
  });

  test('avisa_de_duplicado_al_mover_la_cita_y_la_acepta_confirmada', async () => {
    const { servicio, appointmentModel } = crearEntorno({ cita, duplicada: { id: 9, status: 'PENDIENTE' } });
    const nueva = new Date('2030-03-20T10:00:00');
    await expect(servicio.update(4, { scheduledAt: nueva })).rejects.toMatchObject({ code: 'DUPLICATE_APPOINTMENT' });
    await servicio.update(4, { scheduledAt: nueva, confirmDuplicate: true });
    expect(appointmentModel.update).toHaveBeenCalledWith(4, { scheduledAt: nueva });
  });
});
