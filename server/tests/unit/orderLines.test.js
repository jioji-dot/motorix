import { jest } from '@jest/globals';
import { createOrderService } from '../../services/orderService.js';
import {
  laborSchema,
  serviceLineSchema,
  updateLaborSchema,
  updateOrderSchema,
  updateServiceLineSchema,
} from '../../validators/orderValidator.js';

const MECANICO = { id: 3, role: 'MECHANIC' };
const OTRO_MECANICO = { id: 4, role: 'MECHANIC' };
const RECEPCION = { id: 2, role: 'RECEPTIONIST' };
const ADMIN = { id: 1, role: 'ADMIN' };

function crearEntorno({ orden = { id: 9, status: 'DIAGNOSTICO', mechanicId: 3 }, mecanico = { id: 4, role: 'MECHANIC', active: 1 }, filas = 1 } = {}) {
  const conexion = { id: 'conexion' };
  const orderModel = {
    lockOrder: jest.fn(async () => orden),
    updateFields: jest.fn(async () => {}),
    addService: jest.fn(async () => 11),
    updateService: jest.fn(async () => filas),
    removeService: jest.fn(async () => filas),
    addLabor: jest.fn(async () => 12),
    updateLabor: jest.fn(async () => filas),
    removeLabor: jest.fn(async () => filas),
    recalculateTotal: jest.fn(async () => {}),
    findDetail: jest.fn(async (id) => ({ id, status: orden?.status, mechanicId: orden?.mechanicId, total: '100.00' })),
  };
  const userModel = { findById: jest.fn(async () => mecanico) };
  const servicio = createOrderService({ orderModel, userModel, transaction: async (trabajo) => trabajo(conexion) });
  return { servicio, orderModel, conexion };
}

describe('Validación de servicios y mano de obra', () => {
  test('el_servicio_exige_descripcion_de_1_a_255_caracteres_e_importe', () => {
    expect(serviceLineSchema.safeParse({ description: 'Cambio de aceite', amount: 450 }).success).toBe(true);
    expect(serviceLineSchema.safeParse({ description: '   ', amount: 450 }).success).toBe(false);
    expect(serviceLineSchema.safeParse({ description: 'a'.repeat(256), amount: 450 }).success).toBe(false);
    expect(serviceLineSchema.safeParse({ description: 'a'.repeat(255), amount: 450 }).success).toBe(true);
    expect(serviceLineSchema.safeParse({ description: 'Algo' }).success).toBe(false);
  });

  test('el_importe_no_es_negativo_no_pasa_de_99999999_99_y_tiene_hasta_dos_decimales', () => {
    const con = (amount) => serviceLineSchema.safeParse({ description: 'Algo', amount });
    expect(con(-1).success).toBe(false);
    expect(con(0).success).toBe(true);
    expect(con(99999999.99).success).toBe(true);
    expect(con(100000000).success).toBe(false);
    expect(con(10.123).success).toBe(false);
    expect(con('abc').success).toBe(false);
    expect(serviceLineSchema.parse({ description: 'Algo', amount: '1250.5' }).amount).toBe(1250.5);
  });

  test('la_mano_de_obra_exige_horas_mayores_a_0_hasta_999_99_y_tarifa_no_negativa', () => {
    const con = (hours, hourlyRate) => laborSchema.safeParse({ description: 'Trabajo', hours, hourlyRate });
    expect(con(2.5, 300).success).toBe(true);
    expect(con(0, 300).success).toBe(false);
    expect(con(-1, 300).success).toBe(false);
    expect(con(1000, 300).success).toBe(false);
    expect(con(999.99, 0).success).toBe(true);
    expect(con(2, -5).success).toBe(false);
    expect(con(1.234, 300).success).toBe(false);
  });

  test('la_edicion_de_lineas_exige_al_menos_un_campo', () => {
    expect(updateServiceLineSchema.safeParse({}).success).toBe(false);
    expect(updateServiceLineSchema.safeParse({ amount: 10 }).success).toBe(true);
    expect(updateLaborSchema.safeParse({}).success).toBe(false);
    expect(updateLaborSchema.safeParse({ hours: 3 }).success).toBe(true);
  });

  test('la_edicion_de_la_orden_acepta_textos_de_hasta_4000_caracteres_y_vacios_como_nulos', () => {
    expect(updateOrderSchema.safeParse({}).success).toBe(false);
    expect(updateOrderSchema.safeParse({ diagnosis: 'a'.repeat(4001) }).success).toBe(false);
    expect(updateOrderSchema.safeParse({ diagnosis: 'a'.repeat(4000) }).success).toBe(true);
    expect(updateOrderSchema.parse({ notes: '   ' }).notes).toBeNull();
    expect(updateOrderSchema.safeParse({ reportedProblem: '  ' }).success).toBe(false);
    expect(updateOrderSchema.safeParse({ reportedProblem: 'a'.repeat(2001) }).success).toBe(false);
  });
});

describe('Servicios y mano de obra: permisos y estados', () => {
  const nuevoServicio = { description: 'Cambio de aceite', amount: 450 };

  test('el_mecanico_asignado_agrega_un_servicio_y_el_total_se_recalcula_en_la_misma_transaccion', async () => {
    const { servicio, orderModel, conexion } = crearEntorno();
    await servicio.addService(9, nuevoServicio, MECANICO);
    expect(orderModel.addService).toHaveBeenCalledWith(conexion, 9, nuevoServicio);
    expect(orderModel.recalculateTotal).toHaveBeenCalledWith(conexion, 9);
  });

  test('el_administrador_tambien_puede_editar_las_lineas', async () => {
    const { servicio, orderModel } = crearEntorno();
    await servicio.addLabor(9, { description: 'Trabajo', hours: 2, hourlyRate: 300 }, ADMIN);
    expect(orderModel.addLabor).toHaveBeenCalled();
  });

  test.each([
    ['recepcion', RECEPCION],
    ['otro_mecanico', OTRO_MECANICO],
  ])('%s_no_puede_editar_las_lineas', async (_nombre, usuario) => {
    const { servicio, orderModel } = crearEntorno();
    await expect(servicio.addService(9, nuevoServicio, usuario)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(orderModel.addService).not.toHaveBeenCalled();
  });

  test.each(['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION'])('permite_editar_lineas_en_estado_%s', async (status) => {
    const { servicio, orderModel } = crearEntorno({ orden: { id: 9, status, mechanicId: 3 } });
    await servicio.addService(9, nuevoServicio, MECANICO);
    expect(orderModel.addService).toHaveBeenCalled();
  });

  test.each(['TERMINADO', 'ENTREGADO', 'CANCELADA'])('rechaza_editar_lineas_en_estado_%s', async (status) => {
    const { servicio, orderModel } = crearEntorno({ orden: { id: 9, status, mechanicId: 3 } });
    await expect(servicio.addService(9, nuevoServicio, MECANICO)).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_NOT_EDITABLE',
    });
    await expect(servicio.removeLabor(9, 5, MECANICO)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
    expect(orderModel.addService).not.toHaveBeenCalled();
  });

  test('devuelve_404_si_la_orden_no_existe_o_si_la_linea_no_pertenece_a_la_orden', async () => {
    await expect(crearEntorno({ orden: null }).servicio.addService(9, nuevoServicio, MECANICO)).rejects.toMatchObject({ status: 404 });
    const sinLinea = crearEntorno({ filas: 0 });
    await expect(sinLinea.servicio.updateService(9, 77, { amount: 10 }, MECANICO)).rejects.toMatchObject({ status: 404 });
    await expect(sinLinea.servicio.removeService(9, 77, MECANICO)).rejects.toMatchObject({ status: 404 });
    await expect(sinLinea.servicio.updateLabor(9, 77, { hours: 1 }, MECANICO)).rejects.toMatchObject({ status: 404 });
    expect(sinLinea.orderModel.recalculateTotal).not.toHaveBeenCalled();
  });

  test('editar_y_quitar_lineas_tambien_recalcula_el_total', async () => {
    const { servicio, orderModel, conexion } = crearEntorno();
    await servicio.updateService(9, 11, { amount: 20 }, MECANICO);
    await servicio.removeService(9, 11, MECANICO);
    await servicio.updateLabor(9, 12, { hours: 3 }, MECANICO);
    await servicio.removeLabor(9, 12, MECANICO);
    expect(orderModel.recalculateTotal).toHaveBeenCalledTimes(4);
    expect(orderModel.recalculateTotal).toHaveBeenCalledWith(conexion, 9);
  });
});

describe('Edición de la orden: permisos por campo', () => {
  test.each([
    ['diagnosis', 'Falla en la bomba'],
    ['notes', 'Corrosión'],
    ['recommendations', 'Cambiar mangueras'],
  ])('el_mecanico_asignado_y_admin_editan_%s', async (campo, valor) => {
    const { servicio, orderModel, conexion } = crearEntorno();
    await servicio.update(9, { [campo]: valor }, MECANICO);
    await servicio.update(9, { [campo]: valor }, ADMIN);
    expect(orderModel.updateFields).toHaveBeenCalledWith(conexion, 9, { [campo]: valor });
    expect(orderModel.updateFields).toHaveBeenCalledTimes(2);
  });

  test('recepcion_no_puede_editar_el_diagnostico_ni_otro_mecanico', async () => {
    const { servicio, orderModel } = crearEntorno();
    await expect(servicio.update(9, { diagnosis: 'x' }, RECEPCION)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.update(9, { notes: 'x' }, OTRO_MECANICO)).rejects.toMatchObject({ status: 403 });
    expect(orderModel.updateFields).not.toHaveBeenCalled();
  });

  test('el_mecanico_no_puede_cambiar_el_problema_reportado_ni_reasignar', async () => {
    const { servicio } = crearEntorno();
    await expect(servicio.update(9, { reportedProblem: 'x' }, MECANICO)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.update(9, { mechanicId: 4 }, MECANICO)).rejects.toMatchObject({ status: 403 });
  });

  test('recepcion_edita_el_problema_reportado_y_reasigna_el_mecanico', async () => {
    const { servicio, orderModel, conexion } = crearEntorno();
    await servicio.update(9, { reportedProblem: 'Nuevo problema', mechanicId: 4 }, RECEPCION);
    expect(orderModel.updateFields).toHaveBeenCalledWith(conexion, 9, { reportedProblem: 'Nuevo problema', mechanicId: 4 });
  });

  test('un_mecanico_nuevo_debe_ser_activo_y_con_rol_de_mecanico', async () => {
    const inactivo = crearEntorno({ mecanico: { id: 4, role: 'MECHANIC', active: 0 } });
    const error = await inactivo.servicio.update(9, { mechanicId: 4 }, RECEPCION).catch((e) => e);
    expect(error.status).toBe(400);
    expect(error.details[0].field).toBe('mechanicId');
    await expect(crearEntorno({ mecanico: { id: 4, role: 'ADMIN', active: 1 } }).servicio.update(9, { mechanicId: 4 }, RECEPCION)).rejects.toMatchObject({ status: 400 });
    await expect(crearEntorno({ mecanico: null }).servicio.update(9, { mechanicId: 4 }, RECEPCION)).rejects.toMatchObject({ status: 404 });
  });

  test('el_diagnostico_solo_se_edita_con_la_orden_en_curso_pero_la_reasignacion_tambien_en_terminado', async () => {
    const terminada = crearEntorno({ orden: { id: 9, status: 'TERMINADO', mechanicId: 3 } });
    await expect(terminada.servicio.update(9, { diagnosis: 'x' }, MECANICO)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
    await expect(terminada.servicio.update(9, { reportedProblem: 'x' }, RECEPCION)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
    await expect(terminada.servicio.update(9, { mechanicId: 4 }, RECEPCION)).resolves.toBeDefined();

    for (const status of ['ENTREGADO', 'CANCELADA']) {
      const final = crearEntorno({ orden: { id: 9, status, mechanicId: 3 } });
      await expect(final.servicio.update(9, { mechanicId: 4 }, RECEPCION)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
    }
  });

  test('devuelve_404_si_la_orden_no_existe', async () => {
    await expect(crearEntorno({ orden: null }).servicio.update(9, { diagnosis: 'x' }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });
});
