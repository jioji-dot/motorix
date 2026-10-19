import { jest } from '@jest/globals';
import { createMaintenanceService } from '../../services/maintenanceService.js';
import { createMaintenanceSchema, updateMaintenanceSchema } from '../../validators/maintenanceValidator.js';

const valido = {
  vehicleId: 1,
  serviceType: 'Cambio de aceite',
  lastServiceDate: '2026-10-01',
  lastMileage: 50000,
  nextDate: '2027-04-01',
  nextMileage: 55000,
};

describe('Validación del alta de mantenimientos', () => {
  const con = (cambios) => createMaintenanceSchema.safeParse({ ...valido, ...cambios });
  const campos = (resultado) => resultado.error.issues.map((i) => i.path.join('.'));

  test('acepta_un_mantenimiento_completo', () => {
    expect(con({}).success).toBe(true);
  });

  test('el_tipo_de_servicio_es_obligatorio_y_hasta_100_caracteres', () => {
    expect(con({ serviceType: '   ' }).success).toBe(false);
    expect(con({ serviceType: 'a'.repeat(100) }).success).toBe(true);
    expect(con({ serviceType: 'a'.repeat(101) }).success).toBe(false);
  });

  test('exige_al_menos_proxima_fecha_o_proximo_kilometraje', () => {
    const sinAmbos = con({ nextDate: undefined, nextMileage: undefined });
    expect(sinAmbos.success).toBe(false);
    expect(sinAmbos.error.issues[0].message).toContain('próxima fecha');
    expect(con({ nextDate: undefined }).success).toBe(true);
    expect(con({ nextMileage: undefined }).success).toBe(true);
    expect(con({ nextDate: null, nextMileage: null }).success).toBe(false);
  });

  test('la_proxima_fecha_no_puede_ser_anterior_al_ultimo_servicio', () => {
    const malo = con({ nextDate: '2026-09-30' });
    expect(malo.success).toBe(false);
    expect(campos(malo)).toContain('nextDate');
    expect(con({ nextDate: '2026-10-01' }).success).toBe(true);
  });

  test('el_proximo_kilometraje_debe_ser_mayor_al_del_ultimo_servicio', () => {
    expect(con({ nextMileage: 50000 }).success).toBe(false);
    expect(campos(con({ nextMileage: 49000 }))).toContain('nextMileage');
    expect(con({ nextMileage: 50001 }).success).toBe(true);
  });

  test('los_kilometrajes_son_enteros_hasta_1500000', () => {
    expect(con({ lastMileage: 1500001, nextMileage: undefined }).success).toBe(false);
    expect(con({ nextMileage: 1500001 }).success).toBe(false);
    expect(con({ lastMileage: 100.5 }).success).toBe(false);
    expect(con({ nextMileage: 1500000 }).success).toBe(true);
  });

  test('las_notas_admiten_hasta_2000_caracteres_y_vacias_pasan_a_nulo', () => {
    expect(con({ notes: 'a'.repeat(2000) }).success).toBe(true);
    expect(con({ notes: 'a'.repeat(2001) }).success).toBe(false);
    expect(con({ notes: '  ' }).data.notes).toBeNull();
  });

  test('las_fechas_deben_tener_formato_valido', () => {
    expect(con({ lastServiceDate: '01/10/2026' }).success).toBe(false);
    expect(con({ nextDate: '2027-02-31x' }).success).toBe(false);
  });

  test('la_edicion_exige_al_menos_un_campo', () => {
    expect(updateMaintenanceSchema.safeParse({}).success).toBe(false);
    expect(updateMaintenanceSchema.safeParse({ nextDate: null }).success).toBe(true);
  });
});

function crearEntorno({ vehiculo = { id: 1 }, actual, ordenExiste = true } = {}) {
  const conexion = { id: 'conexion' };
  const maintenanceModel = {
    orderExists: jest.fn(async () => ordenExiste),
    createReplacing: jest.fn(async () => 7),
    findById: jest.fn(async () => ({
      id: 7,
      status: 'PENDIENTE',
      nextDate: '2026-10-25',
      nextMileage: null,
      vehicle: { currentMileage: 50000 },
    })),
    lock: jest.fn(async () => actual),
    update: jest.fn(async () => {}),
    listAll: jest.fn(async () => []),
  };
  const vehicleModel = { findById: jest.fn(async () => vehiculo) };
  const servicio = createMaintenanceService({
    maintenanceModel,
    vehicleModel,
    transaction: async (trabajo) => trabajo(conexion),
    hoy: () => '2026-10-19',
  });
  return { servicio, maintenanceModel, conexion };
}

describe('Servicio de mantenimientos', () => {
  test('el_alta_reemplaza_pendientes_en_una_transaccion_y_devuelve_la_clasificacion', async () => {
    const { servicio, maintenanceModel, conexion } = crearEntorno();
    const resultado = await servicio.create(valido, { id: 3 });
    expect(maintenanceModel.createReplacing).toHaveBeenCalledWith(conexion, { ...valido, createdBy: 3 });
    expect(resultado).toMatchObject({ id: 7, classification: 'PROXIMO', daysLeft: 6 });
  });

  test('rechaza_con_404_un_vehiculo_o_una_orden_de_origen_inexistentes', async () => {
    const sinVehiculo = crearEntorno({ vehiculo: null });
    await expect(sinVehiculo.servicio.create(valido, { id: 3 })).rejects.toMatchObject({ status: 404 });
    const sinOrden = crearEntorno({ ordenExiste: false });
    await expect(sinOrden.servicio.create({ ...valido, sourceOrderId: 99 }, { id: 3 })).rejects.toMatchObject({ status: 404 });
    expect(sinOrden.maintenanceModel.createReplacing).not.toHaveBeenCalled();
  });

  test('un_mantenimiento_atendido_no_se_edita', async () => {
    const { servicio, maintenanceModel } = crearEntorno({ actual: { id: 7, status: 'ATENDIDO' } });
    await expect(servicio.update(7, { notes: 'x' })).rejects.toMatchObject({ status: 409, code: 'MAINTENANCE_NOT_EDITABLE' });
    expect(maintenanceModel.update).not.toHaveBeenCalled();
  });

  test('la_edicion_valida_las_reglas_con_el_resultado_final', async () => {
    const actual = { id: 7, status: 'PENDIENTE', lastServiceDate: '2026-10-01', lastMileage: 50000, nextDate: '2027-01-01', nextMileage: 55000 };
    const { servicio, maintenanceModel } = crearEntorno({ actual });
    await expect(servicio.update(7, { nextDate: null, nextMileage: null })).rejects.toMatchObject({ status: 400 });
    await expect(servicio.update(7, { lastMileage: 56000 })).rejects.toMatchObject({
      status: 400,
      details: [{ field: 'nextMileage', message: expect.any(String) }],
    });
    await expect(servicio.update(7, { nextDate: null })).resolves.toBeDefined();
    expect(maintenanceModel.update).toHaveBeenCalledTimes(1);
  });

  test('puede_quitar_un_valor_mientras_quede_el_otro', async () => {
    const actual = { id: 7, status: 'PENDIENTE', lastServiceDate: '2026-10-01', lastMileage: 50000, nextDate: '2027-01-01', nextMileage: null };
    const { servicio } = crearEntorno({ actual });
    await expect(servicio.update(7, { nextMileage: 52000, nextDate: null })).resolves.toBeDefined();
  });

  test('el_servicio_de_edicion_responde_404_si_no_existe', async () => {
    const { servicio } = crearEntorno({ actual: null });
    await expect(servicio.update(7, { notes: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});
