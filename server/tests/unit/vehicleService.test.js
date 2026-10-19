import { jest } from '@jest/globals';
import { createVehicleService } from '../../services/vehicleService.js';
import { createVehicleSchema, updateVehicleSchema } from '../../validators/vehicleValidator.js';

const BASE = {
  clientId: 1,
  brand: 'Nissan',
  model: 'Versa',
  year: 2020,
  licensePlate: 'abc-123-a',
  currentMileage: 45000,
};

function crearEntorno({ vehiculo = null, cliente = { id: 1, name: 'Ana' }, placas = [], vins = [] } = {}) {
  const vehicleModel = {
    findById: jest.fn(async () => vehiculo),
    findByLicensePlate: jest.fn(async (placa, excluirId) => placas.filter((v) => v.licensePlate === placa && v.id !== excluirId)[0] ?? null),
    findByVin: jest.fn(async (vin, excluirId) => vins.filter((v) => v.vin === vin && v.id !== excluirId)[0] ?? null),
    create: jest.fn(async (datos) => ({ id: 10, ...datos })),
    update: jest.fn(async (id, datos) => ({ ...vehiculo, ...datos })),
    list: jest.fn(),
  };
  const clientModel = { findById: jest.fn(async () => cliente) };
  return { servicio: createVehicleService({ vehicleModel, clientModel }), vehicleModel, clientModel };
}

describe('Validación de vehículos', () => {
  test('guarda_las_placas_en_mayusculas_y_sin_espacios', () => {
    const resultado = createVehicleSchema.parse({ ...BASE, licensePlate: ' abc 123-a ' });
    expect(resultado.licensePlate).toBe('ABC123-A');
  });

  test('exige_propietario_marca_modelo_placas_anio_y_kilometraje', () => {
    const resultado = createVehicleSchema.safeParse({});
    const campos = resultado.error.issues.map((i) => i.path[0]);
    expect(campos).toEqual(expect.arrayContaining(['clientId', 'brand', 'model', 'year', 'licensePlate', 'currentMileage']));
  });

  test('el_mensaje_de_propietario_obligatorio_esta_en_espanol', () => {
    const resultado = createVehicleSchema.safeParse({ ...BASE, clientId: undefined });
    expect(resultado.error.issues[0].message).toBe('El propietario es obligatorio.');
  });

  test('el_vin_es_opcional_y_si_se_captura_tiene_17_caracteres_alfanumericos', () => {
    expect(createVehicleSchema.safeParse(BASE).success).toBe(true);
    expect(createVehicleSchema.parse({ ...BASE, vin: '' }).vin).toBeNull();
    expect(createVehicleSchema.parse({ ...BASE, vin: '3n1cn7ap5kl123456' }).vin).toBe('3N1CN7AP5KL123456');
    expect(createVehicleSchema.safeParse({ ...BASE, vin: 'CORTO' }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...BASE, vin: '3N1CN7AP5KL12345!' }).success).toBe(false);
  });

  test('el_anio_va_de_1950_al_anio_actual_mas_uno', () => {
    const anioActual = new Date().getFullYear();
    expect(createVehicleSchema.safeParse({ ...BASE, year: 1949 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...BASE, year: 1950 }).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...BASE, year: anioActual + 1 }).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...BASE, year: anioActual + 2 }).success).toBe(false);
  });

  test('el_kilometraje_es_un_entero_mayor_o_igual_a_cero', () => {
    expect(createVehicleSchema.safeParse({ ...BASE, currentMileage: 0 }).success).toBe(true);
    expect(createVehicleSchema.safeParse({ ...BASE, currentMileage: -1 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...BASE, currentMileage: 10.5 }).success).toBe(false);
  });

  test('la_edicion_no_permite_cambiar_de_propietario_en_este_sprint', () => {
    const resultado = updateVehicleSchema.parse({ brand: 'Kia', clientId: 5 });
    expect(resultado).not.toHaveProperty('clientId');
  });
});

describe('vehicleService.create', () => {
  test('rechaza_con_404_si_el_propietario_no_existe', async () => {
    const { servicio, vehicleModel } = crearEntorno({ cliente: null });
    await expect(servicio.create({ ...BASE, licensePlate: 'ABC123A' })).rejects.toMatchObject({ status: 404 });
    expect(vehicleModel.create).not.toHaveBeenCalled();
  });

  test('rechaza_con_409_si_las_placas_ya_existen', async () => {
    const { servicio } = crearEntorno({ placas: [{ id: 3, licensePlate: 'ABC123A' }] });
    const error = await servicio.create({ ...BASE, licensePlate: 'ABC123A' }).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('DUPLICATE_VALUE');
    expect(error.details).toEqual([{ field: 'licensePlate', message: expect.stringMatching(/placas/i) }]);
  });

  test('rechaza_con_409_si_el_vin_ya_existe_pero_permite_varios_sin_vin', async () => {
    const { servicio, vehicleModel } = crearEntorno({ vins: [{ id: 3, vin: '3N1CN7AP5KL123456' }] });
    await expect(
      servicio.create({ ...BASE, licensePlate: 'AAA111A', vin: '3N1CN7AP5KL123456' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_VALUE' });

    await servicio.create({ ...BASE, licensePlate: 'AAA111A', vin: null });
    expect(vehicleModel.findByVin).not.toHaveBeenCalledWith(null, expect.anything());
    expect(vehicleModel.create).toHaveBeenCalledTimes(1);
  });

  test('crea_el_vehiculo_asociado_al_propietario', async () => {
    const { servicio, vehicleModel } = crearEntorno();
    const creado = await servicio.create({ ...BASE, licensePlate: 'ABC123A', vin: null });
    expect(vehicleModel.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: 1 }));
    expect(creado.id).toBe(10);
  });
});

describe('vehicleService.update', () => {
  const actual = { id: 4, clientId: 1, licensePlate: 'ABC123A', vin: null, currentMileage: 50000 };

  test('devuelve_404_si_el_vehiculo_no_existe', async () => {
    const { servicio } = crearEntorno({ vehiculo: null });
    await expect(servicio.update(4, { brand: 'Kia' })).rejects.toMatchObject({ status: 404 });
  });

  test('rechaza_bajar_el_kilometraje_sin_correccion_explicita', async () => {
    const { servicio, vehicleModel } = crearEntorno({ vehiculo: actual });
    const error = await servicio.update(4, { currentMileage: 40000 }).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('MILEAGE_DECREASE');
    expect(vehicleModel.update).not.toHaveBeenCalled();
  });

  test('permite_bajar_el_kilometraje_con_mileageCorrection', async () => {
    const { servicio, vehicleModel } = crearEntorno({ vehiculo: actual });
    await servicio.update(4, { currentMileage: 40000, mileageCorrection: true });
    expect(vehicleModel.update).toHaveBeenCalledWith(4, { currentMileage: 40000 });
  });

  test('permite_subir_o_mantener_el_kilometraje', async () => {
    const { servicio, vehicleModel } = crearEntorno({ vehiculo: actual });
    await servicio.update(4, { currentMileage: 50000 });
    await servicio.update(4, { currentMileage: 52000 });
    expect(vehicleModel.update).toHaveBeenCalledTimes(2);
  });

  test('rechaza_placas_que_pertenecen_a_otro_vehiculo', async () => {
    const { servicio } = crearEntorno({ vehiculo: actual, placas: [{ id: 9, licensePlate: 'ZZZ999Z' }] });
    await expect(servicio.update(4, { licensePlate: 'ZZZ999Z' })).rejects.toMatchObject({ code: 'DUPLICATE_VALUE' });
  });

  test('no_considera_duplicadas_las_propias_placas', async () => {
    const { servicio, vehicleModel } = crearEntorno({ vehiculo: actual, placas: [{ id: 4, licensePlate: 'ABC123A' }] });
    await servicio.update(4, { licensePlate: 'ABC123A', brand: 'Kia' });
    expect(vehicleModel.update).toHaveBeenCalled();
  });
});
