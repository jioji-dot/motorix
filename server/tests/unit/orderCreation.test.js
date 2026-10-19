import { jest } from '@jest/globals';
import { createOrderService } from '../../services/orderService.js';
import { createOrderSchema } from '../../validators/orderValidator.js';

const BASE = { clientId: 1, vehicleId: 7, mechanicId: 3, entryMileage: 45000, reportedProblem: 'Ruido en el motor' };

function crearEntorno({
  cliente = { id: 1, name: 'Ana', active: true },
  vehiculo = { id: 7, clientId: 1, currentMileage: 40000 },
  mecanico = { id: 3, role: 'MECHANIC', active: 1 },
  cita = null,
  citaConOrden = false,
} = {}) {
  const conexion = { id: 'conexion' };
  const orderModel = {
    create: jest.fn(async () => 55),
    findDetail: jest.fn(async (id) => ({ id, folio: 'OS-000055', status: 'RECIBIDO' })),
    lockAppointment: jest.fn(async () => {}),
  };
  const appointmentModel = {
    findById: jest.fn(async () => cita),
    hasActiveOrder: jest.fn(async () => citaConOrden),
    setStatus: jest.fn(async () => {}),
  };
  const clientModel = { findById: jest.fn(async () => cliente) };
  const vehicleModel = { findById: jest.fn(async () => vehiculo), updateMileage: jest.fn(async () => {}) };
  const userModel = { findById: jest.fn(async () => mecanico) };
  const servicio = createOrderService({
    orderModel,
    appointmentModel,
    clientModel,
    vehicleModel,
    userModel,
    transaction: async (trabajo) => trabajo(conexion),
  });
  return { servicio, orderModel, appointmentModel, vehicleModel, conexion };
}

const analizar = (datos) => createOrderSchema.parse(datos);

describe('Validación del alta de órdenes', () => {
  test('acepta_una_orden_valida', () => {
    expect(createOrderSchema.safeParse(BASE).success).toBe(true);
  });

  test('el_kilometraje_de_entrada_es_obligatorio_entero_y_va_de_0_a_1500000', () => {
    expect(createOrderSchema.safeParse({ ...BASE, entryMileage: undefined }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...BASE, entryMileage: -1 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...BASE, entryMileage: 10.5 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...BASE, entryMileage: 1500001 }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...BASE, entryMileage: 0 }).success).toBe(true);
    expect(createOrderSchema.safeParse({ ...BASE, entryMileage: 1500000 }).success).toBe(true);
  });

  test('el_mecanico_es_obligatorio_con_mensaje_en_espanol', () => {
    const resultado = createOrderSchema.safeParse({ ...BASE, mechanicId: undefined });
    expect(resultado.error.issues[0].message).toBe('El mecánico es obligatorio.');
  });

  test('el_problema_reportado_es_obligatorio_salvo_que_venga_de_una_cita', () => {
    const sin = createOrderSchema.safeParse({ ...BASE, reportedProblem: undefined });
    expect(sin.success).toBe(false);
    expect(sin.error.issues[0].path[0]).toBe('reportedProblem');
    expect(createOrderSchema.safeParse({ ...BASE, reportedProblem: undefined, appointmentId: 4 }).success).toBe(true);
  });

  test('el_problema_reportado_tiene_de_1_a_2000_caracteres', () => {
    expect(createOrderSchema.safeParse({ ...BASE, reportedProblem: '   ' }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...BASE, reportedProblem: 'a'.repeat(2001) }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...BASE, reportedProblem: 'a'.repeat(2000) }).success).toBe(true);
  });
});

describe('orderService.create', () => {
  const usuario = { id: 2, role: 'RECEPTIONIST' };

  test('crea_la_orden_actualiza_el_kilometraje_del_vehiculo_y_registra_el_historial_en_una_transaccion', async () => {
    const { servicio, orderModel, vehicleModel, conexion } = crearEntorno();
    const orden = await servicio.create(analizar(BASE), usuario);
    expect(orderModel.create).toHaveBeenCalledWith(
      conexion,
      expect.objectContaining({ clientId: 1, vehicleId: 7, mechanicId: 3, entryMileage: 45000, createdBy: 2 }),
    );
    expect(vehicleModel.updateMileage).toHaveBeenCalledWith(7, 45000, conexion);
    expect(orden.folio).toBe('OS-000055');
  });

  test('rechaza_un_cliente_inexistente_y_uno_desactivado', async () => {
    await expect(crearEntorno({ cliente: null }).servicio.create(analizar(BASE), usuario)).rejects.toMatchObject({ status: 404 });
    const error = await crearEntorno({ cliente: { id: 1, active: false } }).servicio.create(analizar(BASE), usuario).catch((e) => e);
    expect(error.status).toBe(400);
    expect(error.details[0].field).toBe('clientId');
  });

  test('rechaza_un_vehiculo_inexistente_o_de_otro_cliente', async () => {
    await expect(crearEntorno({ vehiculo: null }).servicio.create(analizar(BASE), usuario)).rejects.toMatchObject({ status: 404 });
    const error = await crearEntorno({ vehiculo: { id: 7, clientId: 99, currentMileage: 0 } })
      .servicio.create(analizar(BASE), usuario)
      .catch((e) => e);
    expect(error.details).toEqual([{ field: 'vehicleId', message: 'El vehículo no pertenece al cliente seleccionado.' }]);
  });

  test('rechaza_un_mecanico_inexistente_con_404', async () => {
    await expect(crearEntorno({ mecanico: null }).servicio.create(analizar(BASE), usuario)).rejects.toMatchObject({ status: 404 });
  });

  test.each([
    ['con_rol_de_recepcion', { id: 3, role: 'RECEPTIONIST', active: 1 }],
    ['con_rol_de_administrador', { id: 3, role: 'ADMIN', active: 1 }],
    ['desactivado', { id: 3, role: 'MECHANIC', active: 0 }],
  ])('rechaza_un_responsable_%s', async (_nombre, mecanico) => {
    const { servicio, orderModel } = crearEntorno({ mecanico });
    const error = await servicio.create(analizar(BASE), usuario).catch((e) => e);
    expect(error.status).toBe(400);
    expect(error.details[0].field).toBe('mechanicId');
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  test('rechaza_un_kilometraje_menor_al_del_vehiculo_sin_correccion_explicita', async () => {
    const { servicio, orderModel } = crearEntorno({ vehiculo: { id: 7, clientId: 1, currentMileage: 50000 } });
    const error = await servicio.create(analizar(BASE), usuario).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('MILEAGE_DECREASE');
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  test('acepta_un_kilometraje_menor_con_mileageCorrection_y_lo_guarda_en_el_vehiculo', async () => {
    const { servicio, vehicleModel, conexion } = crearEntorno({ vehiculo: { id: 7, clientId: 1, currentMileage: 50000 } });
    await servicio.create(analizar({ ...BASE, mileageCorrection: true }), usuario);
    expect(vehicleModel.updateMileage).toHaveBeenCalledWith(7, 45000, conexion);
  });

  test('con_0_km_previos_acepta_cualquier_valor_del_rango_y_acepta_un_kilometraje_igual', async () => {
    const sinKm = crearEntorno({ vehiculo: { id: 7, clientId: 1, currentMileage: 0 } });
    await expect(sinKm.servicio.create(analizar({ ...BASE, entryMileage: 123456 }), usuario)).resolves.toBeDefined();
    const igual = crearEntorno({ vehiculo: { id: 7, clientId: 1, currentMileage: 45000 } });
    await expect(igual.servicio.create(analizar(BASE), usuario)).resolves.toBeDefined();
  });

  describe('desde una cita', () => {
    const cita = { id: 4, clientId: 1, vehicleId: 7, status: 'CONFIRMADA', reason: 'Revisión de frenos' };
    const datosCita = { clientId: 1, vehicleId: 7, mechanicId: 3, entryMileage: 45000, appointmentId: 4 };

    test('toma_el_motivo_de_la_cita_como_problema_reportado_y_la_pasa_a_en_proceso', async () => {
      const { servicio, orderModel, appointmentModel, conexion } = crearEntorno({ cita });
      await servicio.create(analizar(datosCita), usuario);
      expect(orderModel.create).toHaveBeenCalledWith(
        conexion,
        expect.objectContaining({ appointmentId: 4, reportedProblem: 'Revisión de frenos' }),
      );
      expect(appointmentModel.setStatus).toHaveBeenCalledWith(4, 'EN_PROCESO', conexion);
    });

    test('rechaza_una_cita_inexistente_con_404', async () => {
      await expect(crearEntorno({ cita: null }).servicio.create(analizar(datosCita), usuario)).rejects.toMatchObject({ status: 404 });
    });

    test.each(['PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'])('rechaza_una_cita_%s', async (status) => {
      const { servicio } = crearEntorno({ cita: { ...cita, status } });
      await expect(servicio.create(analizar(datosCita), usuario)).rejects.toMatchObject({
        status: 409,
        code: 'APPOINTMENT_NOT_EDITABLE',
      });
    });

    test('rechaza_si_el_cliente_o_el_vehiculo_no_coinciden_con_los_de_la_cita', async () => {
      const { servicio } = crearEntorno({ cita: { ...cita, vehicleId: 8 } });
      const error = await servicio.create(analizar(datosCita), usuario).catch((e) => e);
      expect(error.status).toBe(400);
      expect(error.details[0].field).toBe('appointmentId');
    });

    test('rechaza_una_cita_que_ya_tiene_una_orden_activa', async () => {
      const { servicio, orderModel } = crearEntorno({ cita, citaConOrden: true });
      await expect(servicio.create(analizar(datosCita), usuario)).rejects.toMatchObject({
        status: 409,
        code: 'APPOINTMENT_ALREADY_HAS_ORDER',
      });
      expect(orderModel.create).not.toHaveBeenCalled();
    });
  });
});
