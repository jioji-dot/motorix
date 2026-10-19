import { jest } from '@jest/globals';
import { createOrderService } from '../../services/orderService.js';
import { changeStatusSchema } from '../../validators/orderValidator.js';

const MECANICO = { id: 3, role: 'MECHANIC' };
const OTRO_MECANICO = { id: 4, role: 'MECHANIC' };
const RECEPCION = { id: 2, role: 'RECEPTIONIST' };
const ADMIN = { id: 1, role: 'ADMIN' };

function crearEntorno({
  orden = { id: 9, status: 'EN_REPARACION', mechanicId: 3, appointmentId: null, diagnosis: 'Falla' },
  lineas = { services: 1, labor: 0 },
  filasAfectadas = 1,
  lineasDeRefaccion = [],
} = {}) {
  const conexion = { id: 'conexion' };
  const orderModel = {
    lockOrder: jest.fn(async () => orden),
    countLines: jest.fn(async () => lineas),
    changeStatus: jest.fn(async () => filasAfectadas),
    findDetail: jest.fn(async (id) => ({ id, status: 'X', mechanicId: 3, services: [], labor: [], history: [] })),
  };
  const appointmentModel = { setStatus: jest.fn(async () => {}) };
  const orderPartModel = { listByOrder: jest.fn(async () => lineasDeRefaccion) };
  const inventoryService = { applyMovement: jest.fn(async () => ({})) };
  const servicio = createOrderService({ orderModel, appointmentModel, orderPartModel, inventoryService, transaction: async (trabajo) => trabajo(conexion) });
  return { servicio, orderModel, appointmentModel, orderPartModel, inventoryService, conexion };
}

describe('Validación del cambio de estado', () => {
  test('exige_un_estado_valido', () => {
    expect(changeStatusSchema.safeParse({ status: 'DIAGNOSTICO' }).success).toBe(true);
    expect(changeStatusSchema.safeParse({ status: 'OTRO' }).success).toBe(false);
    expect(changeStatusSchema.safeParse({}).success).toBe(false);
  });

  test('al_cancelar_el_motivo_es_obligatorio_y_tiene_hasta_255_caracteres', () => {
    expect(changeStatusSchema.safeParse({ status: 'CANCELADA' }).success).toBe(false);
    expect(changeStatusSchema.safeParse({ status: 'CANCELADA', reason: '   ' }).success).toBe(false);
    expect(changeStatusSchema.safeParse({ status: 'CANCELADA', reason: 'a'.repeat(256) }).success).toBe(false);
    expect(changeStatusSchema.safeParse({ status: 'CANCELADA', reason: 'El cliente se fue' }).success).toBe(true);
    const faltante = changeStatusSchema.safeParse({ status: 'CANCELADA' });
    expect(faltante.error.issues[0]).toMatchObject({ path: ['reason'], message: 'Indica el motivo de la cancelación.' });
  });
});

describe('orderService.changeStatus', () => {
  test('aplica_una_transicion_valida_registrando_historial_con_usuario_y_motivo_en_una_transaccion', async () => {
    const { servicio, orderModel, conexion } = crearEntorno({ lineas: { services: 1, labor: 1 } });
    await servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO);
    expect(orderModel.changeStatus).toHaveBeenCalledWith(conexion, {
      id: 9,
      from: 'EN_REPARACION',
      to: 'TERMINADO',
      userId: 3,
      reason: null,
    });
  });

  test('devuelve_404_si_la_orden_no_existe', async () => {
    const { servicio } = crearEntorno({ orden: null });
    await expect(servicio.changeStatus(9, { status: 'DIAGNOSTICO' }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  test('un_mecanico_ajeno_recibe_FORBIDDEN', async () => {
    const { servicio, orderModel } = crearEntorno();
    await expect(servicio.changeStatus(9, { status: 'TERMINADO' }, OTRO_MECANICO)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(orderModel.changeStatus).not.toHaveBeenCalled();
  });

  test('rechaza_un_salto_con_INVALID_TRANSITION_e_indica_las_permitidas_para_el_usuario', async () => {
    const { servicio, orderModel } = crearEntorno({ orden: { id: 9, status: 'DIAGNOSTICO', mechanicId: 3, diagnosis: 'x' } });
    const error = await servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('INVALID_TRANSITION');
    expect(error.details).toEqual(['EN_REPARACION']);
    expect(orderModel.changeStatus).not.toHaveBeenCalled();
  });

  test('el_mecanico_no_puede_entregar_ni_cancelar_aunque_la_transicion_exista', async () => {
    const terminada = crearEntorno({ orden: { id: 9, status: 'TERMINADO', mechanicId: 3 } });
    await expect(terminada.servicio.changeStatus(9, { status: 'ENTREGADO' }, MECANICO)).rejects.toMatchObject({ status: 403 });
    const enCurso = crearEntorno();
    await expect(enCurso.servicio.changeStatus(9, { status: 'CANCELADA', reason: 'x' }, MECANICO)).rejects.toMatchObject({ status: 403 });
  });

  test('recepcion_no_puede_avanzar_el_trabajo_del_mecanico', async () => {
    const { servicio } = crearEntorno({ orden: { id: 9, status: 'RECIBIDO', mechanicId: 3 } });
    await expect(servicio.changeStatus(9, { status: 'DIAGNOSTICO' }, RECEPCION)).rejects.toMatchObject({ status: 403 });
  });

  describe('al terminar', () => {
    test('exige_diagnostico', async () => {
      const { servicio, orderModel } = crearEntorno({
        orden: { id: 9, status: 'EN_REPARACION', mechanicId: 3, diagnosis: '  ' },
        lineas: { services: 2, labor: 0 },
      });
      const error = await servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO).catch((e) => e);
      expect(error.status).toBe(409);
      expect(error.code).toBe('ORDER_INCOMPLETE');
      expect(error.message).toMatch(/diagnóstico/);
      expect(orderModel.changeStatus).not.toHaveBeenCalled();
    });

    test('exige_al_menos_un_servicio_o_una_mano_de_obra', async () => {
      const { servicio } = crearEntorno({ lineas: { services: 0, labor: 0 } });
      const error = await servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO).catch((e) => e);
      expect(error.code).toBe('ORDER_INCOMPLETE');
      expect(error.message).toMatch(/servicio o mano de obra/);
    });

    test('indica_todo_lo_que_falta_a_la_vez', async () => {
      const { servicio } = crearEntorno({
        orden: { id: 9, status: 'EN_REPARACION', mechanicId: 3, diagnosis: null },
        lineas: { services: 0, labor: 0 },
      });
      const error = await servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO).catch((e) => e);
      expect(error.message).toMatch(/diagnóstico/);
      expect(error.message).toMatch(/servicio o mano de obra/);
    });

    test.each([
      ['solo_servicios', { services: 1, labor: 0 }],
      ['solo_mano_de_obra', { services: 0, labor: 1 }],
    ])('basta_con_%s', async (_nombre, lineas) => {
      const { servicio, orderModel } = crearEntorno({ lineas });
      await servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO);
      expect(orderModel.changeStatus).toHaveBeenCalled();
    });
  });

  describe('cancelar', () => {
    const orden = { id: 9, status: 'DIAGNOSTICO', mechanicId: 3, appointmentId: 4, diagnosis: null };

    test('guarda_el_motivo_y_devuelve_la_cita_asociada_a_confirmada', async () => {
      const { servicio, orderModel, appointmentModel, conexion } = crearEntorno({ orden });
      await servicio.changeStatus(9, { status: 'CANCELADA', reason: 'El cliente se fue' }, RECEPCION);
      expect(orderModel.changeStatus).toHaveBeenCalledWith(conexion, expect.objectContaining({ to: 'CANCELADA', reason: 'El cliente se fue' }));
      expect(appointmentModel.setStatus).toHaveBeenCalledWith(4, 'CONFIRMADA', conexion);
    });

    test('sin_cita_no_toca_citas', async () => {
      const { servicio, appointmentModel } = crearEntorno({ orden: { ...orden, appointmentId: null } });
      await servicio.changeStatus(9, { status: 'CANCELADA', reason: 'x' }, ADMIN);
      expect(appointmentModel.setStatus).not.toHaveBeenCalled();
    });

    test('desde_terminado_ya_no_se_puede_cancelar', async () => {
      const { servicio } = crearEntorno({ orden: { ...orden, status: 'TERMINADO' } });
      await expect(servicio.changeStatus(9, { status: 'CANCELADA', reason: 'x' }, ADMIN)).rejects.toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });
  });

  describe('entregar', () => {
    test('marca_la_cita_asociada_como_completada', async () => {
      const { servicio, appointmentModel, conexion } = crearEntorno({
        orden: { id: 9, status: 'TERMINADO', mechanicId: 3, appointmentId: 4 },
      });
      await servicio.changeStatus(9, { status: 'ENTREGADO' }, RECEPCION);
      expect(appointmentModel.setStatus).toHaveBeenCalledWith(4, 'COMPLETADA', conexion);
    });

    test.each(['ENTREGADO', 'CANCELADA'])('una_orden_%s_no_admite_ningun_cambio', async (status) => {
      const { servicio } = crearEntorno({ orden: { id: 9, status, mechanicId: 3 } });
      await expect(servicio.changeStatus(9, { status: 'DIAGNOSTICO' }, ADMIN)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });

  describe('cambios simultáneos', () => {
    test('si_el_estado_visto_por_el_usuario_ya_cambio_responde_STATE_CONFLICT', async () => {
      const { servicio, orderModel } = crearEntorno({ orden: { id: 9, status: 'DIAGNOSTICO', mechanicId: 3 } });
      const error = await servicio.changeStatus(9, { status: 'DIAGNOSTICO', expectedStatus: 'RECIBIDO' }, MECANICO).catch((e) => e);
      expect(error.status).toBe(409);
      expect(error.code).toBe('STATE_CONFLICT');
      expect(orderModel.changeStatus).not.toHaveBeenCalled();
    });

    test('si_la_base_no_actualiza_ninguna_fila_responde_STATE_CONFLICT', async () => {
      const { servicio, appointmentModel } = crearEntorno({ filasAfectadas: 0, lineas: { services: 1, labor: 0 } });
      await expect(servicio.changeStatus(9, { status: 'TERMINADO' }, MECANICO)).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
      expect(appointmentModel.setStatus).not.toHaveBeenCalled();
    });
  });
});
