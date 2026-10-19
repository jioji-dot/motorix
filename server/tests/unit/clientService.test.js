import { jest } from '@jest/globals';
import { createClientService } from '../../services/clientService.js';
import { createClientSchema, updateClientSchema } from '../../validators/clientValidator.js';

function crearEntorno({ existentes = [], cliente = null } = {}) {
  const modelo = {
    findByPhone: jest.fn(async (telefono, excluirId) =>
      existentes.filter((c) => c.phone === telefono && c.id !== excluirId),
    ),
    create: jest.fn(async (datos) => ({ id: 99, active: true, ...datos })),
    update: jest.fn(async (id, datos) => ({ ...(cliente ?? { id }), ...datos })),
    findById: jest.fn(async () => cliente),
    findVehiclesByClientId: jest.fn(async () => []),
    list: jest.fn(),
  };
  return { servicio: createClientService({ clientModel: modelo }), modelo };
}

describe('Validación de clientes', () => {
  test('normaliza_el_telefono_a_10_digitos_sin_espacios_ni_guiones', () => {
    const resultado = createClientSchema.parse({ name: 'Ana', phone: '(55) 1234-5678' });
    expect(resultado.phone).toBe('5512345678');
  });

  test('rechaza_telefonos_que_no_tienen_10_digitos', () => {
    expect(createClientSchema.safeParse({ name: 'Ana', phone: '12345' }).success).toBe(false);
    expect(createClientSchema.safeParse({ name: 'Ana', phone: '55123456789' }).success).toBe(false);
  });

  test('exige_nombre_y_limita_su_longitud_a_120_caracteres', () => {
    expect(createClientSchema.safeParse({ phone: '5512345678' }).success).toBe(false);
    expect(createClientSchema.safeParse({ name: '   ', phone: '5512345678' }).success).toBe(false);
    expect(createClientSchema.safeParse({ name: 'a'.repeat(121), phone: '5512345678' }).success).toBe(false);
    expect(createClientSchema.safeParse({ name: 'a'.repeat(120), phone: '5512345678' }).success).toBe(true);
  });

  test('acepta_correo_opcional_pero_exige_formato_valido_si_se_captura', () => {
    expect(createClientSchema.safeParse({ name: 'Ana', phone: '5512345678' }).success).toBe(true);
    expect(createClientSchema.parse({ name: 'Ana', phone: '5512345678', email: '' }).email).toBeNull();
    expect(createClientSchema.safeParse({ name: 'Ana', phone: '5512345678', email: 'no-es-correo' }).success).toBe(false);
    expect(createClientSchema.safeParse({ name: 'Ana', phone: '5512345678', email: 'ana@taller.mx' }).success).toBe(true);
  });

  test('la_edicion_exige_al_menos_un_campo', () => {
    expect(updateClientSchema.safeParse({}).success).toBe(false);
    expect(updateClientSchema.safeParse({ active: false }).success).toBe(true);
  });
});

describe('clientService.create', () => {
  test('crea_el_cliente_cuando_el_telefono_no_existe', async () => {
    const { servicio, modelo } = crearEntorno();
    const cliente = await servicio.create({ name: 'Ana', phone: '5512345678', email: null });
    expect(modelo.create).toHaveBeenCalledWith({ name: 'Ana', phone: '5512345678', email: null });
    expect(cliente.id).toBe(99);
  });

  test('avisa_con_409_y_las_coincidencias_si_el_telefono_ya_existe', async () => {
    const { servicio, modelo } = crearEntorno({
      existentes: [{ id: 3, name: 'Luis Pérez', phone: '5512345678' }],
    });
    const error = await servicio.create({ name: 'Ana', phone: '5512345678' }).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.code).toBe('DUPLICATE_PHONE');
    expect(error.details).toEqual([{ id: 3, name: 'Luis Pérez', phone: '5512345678' }]);
    expect(modelo.create).not.toHaveBeenCalled();
  });

  test('permite_el_telefono_repetido_cuando_se_confirma', async () => {
    const { servicio, modelo } = crearEntorno({
      existentes: [{ id: 3, name: 'Luis Pérez', phone: '5512345678' }],
    });
    await servicio.create({ name: 'Ana', phone: '5512345678', confirmDuplicatePhone: true });
    expect(modelo.create).toHaveBeenCalledTimes(1);
    expect(modelo.create.mock.calls[0][0]).not.toHaveProperty('confirmDuplicatePhone');
  });
});

describe('clientService.update', () => {
  const actual = { id: 5, name: 'Ana', phone: '5511111111', email: null, active: true };

  test('devuelve_404_si_el_cliente_no_existe', async () => {
    const { servicio } = crearEntorno({ cliente: null });
    await expect(servicio.update(5, { name: 'Otro' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  test('no_avisa_si_el_telefono_no_cambia', async () => {
    const { servicio, modelo } = crearEntorno({ cliente: actual, existentes: [{ id: 5, phone: '5511111111' }] });
    await servicio.update(5, { phone: '5511111111', name: 'Ana López' });
    expect(modelo.update).toHaveBeenCalled();
  });

  test('avisa_si_el_telefono_nuevo_ya_pertenece_a_otro_cliente', async () => {
    const { servicio, modelo } = crearEntorno({
      cliente: actual,
      existentes: [{ id: 8, name: 'Luis', phone: '5522222222' }],
    });
    await expect(servicio.update(5, { phone: '5522222222' })).rejects.toMatchObject({ code: 'DUPLICATE_PHONE' });
    expect(modelo.update).not.toHaveBeenCalled();
  });

  test('desactiva_al_cliente_sin_borrar_su_informacion', async () => {
    const { servicio, modelo } = crearEntorno({ cliente: actual });
    await servicio.update(5, { active: false });
    expect(modelo.update).toHaveBeenCalledWith(5, { active: false });
  });
});
