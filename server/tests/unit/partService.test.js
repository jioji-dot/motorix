import { jest } from '@jest/globals';
import { createPartService } from '../../services/partService.js';
import { createPartSchema, partListQuerySchema, updatePartSchema } from '../../validators/partValidator.js';

const valida = {
  code: 'FIL-001',
  name: 'Filtro de aceite',
  category: 'Aceites y filtros',
  brand: 'Bosch',
  minimumStock: 5,
  purchasePrice: 80,
  salePrice: 120,
};

describe('Validación del alta y la edición de refacciones', () => {
  const con = (cambios) => createPartSchema.safeParse({ ...valida, ...cambios });

  test('acepta_una_refaccion_completa_con_o_sin_existencia_inicial', () => {
    expect(con({}).success).toBe(true);
    expect(con({ initialStock: 10 }).success).toBe(true);
  });

  test('el_codigo_es_obligatorio_de_1_a_40_caracteres', () => {
    expect(con({ code: '  ' }).success).toBe(false);
    expect(con({ code: 'a'.repeat(40) }).success).toBe(true);
    expect(con({ code: 'a'.repeat(41) }).success).toBe(false);
    expect(con({ code: ' ABC ' }).data.code).toBe('ABC');
  });

  test('nombre_hasta_120_categoria_y_marca_hasta_60', () => {
    expect(con({ name: 'a'.repeat(121) }).success).toBe(false);
    expect(con({ name: 'a'.repeat(120) }).success).toBe(true);
    expect(con({ category: 'a'.repeat(61) }).success).toBe(false);
    expect(con({ brand: 'a'.repeat(61) }).success).toBe(false);
    expect(con({ brand: '' }).success).toBe(false);
  });

  test('stock_minimo_y_existencia_inicial_son_enteros_de_0_a_1000000', () => {
    expect(con({ minimumStock: 0 }).success).toBe(true);
    expect(con({ minimumStock: -1 }).success).toBe(false);
    expect(con({ minimumStock: 1000001 }).success).toBe(false);
    expect(con({ minimumStock: 2.5 }).success).toBe(false);
    expect(con({ initialStock: 1000001 }).success).toBe(false);
    expect(con({ initialStock: -3 }).success).toBe(false);
  });

  test('los_precios_van_de_0_a_99999999_99_con_hasta_dos_decimales', () => {
    expect(con({ purchasePrice: 0, salePrice: 0 }).success).toBe(true);
    expect(con({ salePrice: -1 }).success).toBe(false);
    expect(con({ salePrice: 100000000 }).success).toBe(false);
    expect(con({ purchasePrice: 10.999 }).success).toBe(false);
    expect(con({ salePrice: '149.90' }).data.salePrice).toBe(149.9);
  });

  test('la_edicion_no_acepta_codigo_ni_stock_y_exige_al_menos_un_campo', () => {
    expect(updatePartSchema.safeParse({}).success).toBe(false);
    const resultado = updatePartSchema.safeParse({ name: 'Nuevo', code: 'OTRO', stock: 999 });
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ name: 'Nuevo' });
    expect(updatePartSchema.safeParse({ active: 'si' }).success).toBe(false);
  });

  test('el_filtro_de_nivel_acepta_LOW_OUT_o_ambos_y_rechaza_otros', () => {
    expect(partListQuerySchema.safeParse({ stockLevel: 'LOW,OUT' }).data.stockLevel).toEqual(['LOW', 'OUT']);
    expect(partListQuerySchema.safeParse({ stockLevel: 'OK' }).success).toBe(false);
    expect(partListQuerySchema.safeParse({ active: 'maybe' }).success).toBe(false);
  });
});

function crearEntorno({ parte = { id: 5, code: 'FIL-001', active: true, stock: 0, purchasePrice: '80.00' }, existente = null } = {}) {
  const conexion = { id: 'conexion' };
  const partModel = {
    findByCode: jest.fn(async () => existente),
    create: jest.fn(async () => 5),
    findById: jest.fn(async () => parte),
    update: jest.fn(async () => {}),
    list: jest.fn(async () => ({ items: [parte], total: 1 })),
  };
  const inventoryModel = {
    listMovements: jest.fn(async () => ({ items: [], total: 0 })),
    findMovement: jest.fn(async () => ({ id: 1 })),
  };
  const inventoryService = {
    applyMovement: jest.fn(async () => ({ movementId: 1, stockAfter: 10 })),
    deltaDe: jest.fn(({ type, quantity }) => (type === 'OUT' ? -quantity : quantity)),
  };
  const servicio = createPartService({ partModel, inventoryModel, inventoryService, transaction: async (t) => t(conexion) });
  return { servicio, partModel, inventoryService, conexion };
}

const ADMIN = { id: 1, role: 'ADMIN' };
const MECANICO = { id: 3, role: 'MECHANIC' };

describe('Servicio de refacciones', () => {
  test('rechaza_un_codigo_repetido_con_409_y_el_campo_code', async () => {
    const { servicio, partModel } = crearEntorno({ existente: { id: 2 } });
    await expect(servicio.create(valida, ADMIN)).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_VALUE',
      details: [{ field: 'code', message: expect.any(String) }],
    });
    expect(partModel.create).not.toHaveBeenCalled();
  });

  test('la_existencia_inicial_genera_un_movimiento_de_entrada_con_motivo_Existencia_inicial', async () => {
    const { servicio, inventoryService, conexion } = crearEntorno();
    await servicio.create({ ...valida, initialStock: 10 }, ADMIN);
    expect(inventoryService.applyMovement).toHaveBeenCalledWith(conexion, {
      partId: 5, type: 'IN', delta: 10, reason: 'Existencia inicial', userId: 1,
    });
  });

  test('sin_existencia_inicial_no_se_registra_ningun_movimiento', async () => {
    const { servicio, inventoryService } = crearEntorno();
    await servicio.create(valida, ADMIN);
    expect(inventoryService.applyMovement).not.toHaveBeenCalled();
  });

  test('desactivar_y_reactivar_solo_cambia_el_campo_active', async () => {
    const { servicio, partModel } = crearEntorno();
    await servicio.update(5, { active: false }, ADMIN);
    await servicio.update(5, { active: true }, ADMIN);
    expect(partModel.update).toHaveBeenNthCalledWith(1, 5, { active: false });
    expect(partModel.update).toHaveBeenNthCalledWith(2, 5, { active: true });
  });

  test('editar_o_mover_una_refaccion_inexistente_responde_404', async () => {
    const { servicio } = crearEntorno({ parte: null });
    await expect(servicio.update(5, { name: 'x' }, ADMIN)).rejects.toMatchObject({ status: 404 });
    await expect(servicio.registerMovement(5, { type: 'IN', quantity: 1, reason: 'x' }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });

  test('las_respuestas_omiten_el_precio_de_compra_a_los_roles_que_no_son_administrador', async () => {
    const { servicio } = crearEntorno();
    expect((await servicio.get(5, ADMIN)).purchasePrice).toBe('80.00');
    expect(await servicio.get(5, MECANICO)).not.toHaveProperty('purchasePrice');
    const lista = await servicio.list({ page: 1, pageSize: 20 }, MECANICO);
    expect(lista.items[0]).not.toHaveProperty('purchasePrice');
  });

  test('quien_no_es_administrador_solo_consulta_refacciones_activas', async () => {
    const { servicio, partModel } = crearEntorno();
    await servicio.list({ page: 1, pageSize: 20, active: 'all' }, MECANICO);
    expect(partModel.list.mock.calls[0][0].active).toBe('true');
    await servicio.list({ page: 1, pageSize: 20, active: 'all' }, ADMIN);
    expect(partModel.list.mock.calls[1][0].active).toBeUndefined();
    await servicio.list({ page: 1, pageSize: 20, active: 'false' }, ADMIN);
    expect(partModel.list.mock.calls[2][0].active).toBe('false');
  });

  test('una_refaccion_inactiva_no_se_ve_para_quien_no_es_administrador', async () => {
    const { servicio } = crearEntorno({ parte: { id: 5, active: false } });
    await expect(servicio.get(5, MECANICO)).rejects.toMatchObject({ status: 404 });
    await expect(servicio.get(5, ADMIN)).resolves.toBeDefined();
  });

  test('registrar_movimiento_traduce_la_cantidad_a_delta_con_signo', async () => {
    const { servicio, inventoryService } = crearEntorno();
    await servicio.registerMovement(5, { type: 'OUT', quantity: 2, reason: 'Merma' }, ADMIN);
    expect(inventoryService.applyMovement.mock.calls[0][1]).toMatchObject({ type: 'OUT', delta: -2, reason: 'Merma', userId: 1 });
  });
});
