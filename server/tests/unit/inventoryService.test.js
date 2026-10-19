import { jest } from '@jest/globals';
import { createInventoryService } from '../../services/inventoryService.js';
import { movementSchema } from '../../validators/partValidator.js';

function crearEntorno(parte = { id: 4, name: 'Filtro de aceite', stock: 5 }) {
  const inventoryModel = {
    lockPart: jest.fn(async () => parte),
    setStock: jest.fn(async () => {}),
    insertMovement: jest.fn(async () => 99),
  };
  return { servicio: createInventoryService({ inventoryModel }), inventoryModel };
}

const conexion = { id: 'conexion' };

describe('Validación de movimientos de inventario', () => {
  const con = (cambios) => movementSchema.safeParse({ type: 'IN', quantity: 3, reason: 'Compra', ...cambios });

  test('la_entrada_y_la_salida_manual_exigen_cantidad_entera_mayor_a_0', () => {
    for (const type of ['IN', 'OUT']) {
      expect(con({ type, quantity: 1 }).success).toBe(true);
      expect(con({ type, quantity: 0 }).success).toBe(false);
      expect(con({ type, quantity: -2 }).success).toBe(false);
      expect(con({ type, quantity: 1.5 }).success).toBe(false);
      expect(con({ type, quantity: 1000001 }).success).toBe(false);
    }
  });

  test('el_ajuste_es_una_diferencia_entera_con_signo_distinta_de_cero', () => {
    expect(con({ type: 'ADJUSTMENT', quantity: -4 }).success).toBe(true);
    expect(con({ type: 'ADJUSTMENT', quantity: 4 }).success).toBe(true);
    expect(con({ type: 'ADJUSTMENT', quantity: 0 }).success).toBe(false);
    expect(con({ type: 'ADJUSTMENT', quantity: 2.5 }).success).toBe(false);
    expect(con({ type: 'ADJUSTMENT', quantity: -1000001 }).success).toBe(false);
  });

  test('el_motivo_es_obligatorio_y_de_hasta_255_caracteres', () => {
    expect(con({ reason: '   ' }).success).toBe(false);
    expect(con({ reason: undefined }).success).toBe(false);
    expect(con({ reason: 'a'.repeat(255) }).success).toBe(true);
    expect(con({ reason: 'a'.repeat(256) }).success).toBe(false);
  });

  test('el_tipo_debe_ser_IN_OUT_o_ADJUSTMENT', () => {
    expect(con({ type: 'TRASPASO' }).success).toBe(false);
  });
});

describe('Servicio de inventario: applyMovement', () => {
  test('una_entrada_suma_actualiza_el_stock_y_registra_el_stock_resultante', async () => {
    const { servicio, inventoryModel } = crearEntorno();
    const resultado = await servicio.applyMovement(conexion, { partId: 4, type: 'IN', delta: 3, reason: 'Compra', userId: 1 });
    expect(resultado).toEqual({ movementId: 99, stockAfter: 8 });
    expect(inventoryModel.setStock).toHaveBeenCalledWith(conexion, 4, 8);
    expect(inventoryModel.insertMovement).toHaveBeenCalledWith(conexion, {
      partId: 4, type: 'IN', quantity: 3, stockAfter: 8, reason: 'Compra', orderId: null, createdBy: 1,
    });
  });

  test('una_salida_guarda_la_cantidad_negativa_y_puede_dejar_el_stock_en_cero', async () => {
    const { servicio, inventoryModel } = crearEntorno();
    const resultado = await servicio.applyMovement(conexion, { partId: 4, type: 'OUT', delta: -5, reason: 'Merma', userId: 1 });
    expect(resultado.stockAfter).toBe(0);
    expect(inventoryModel.insertMovement.mock.calls[0][1]).toMatchObject({ quantity: -5, stockAfter: 0 });
  });

  test('rechaza_con_INSUFFICIENT_STOCK_si_el_resultado_seria_negativo_y_no_escribe_nada', async () => {
    const { servicio, inventoryModel } = crearEntorno();
    await expect(
      servicio.applyMovement(conexion, { partId: 4, type: 'ADJUSTMENT', delta: -6, reason: 'Conteo', userId: 1 }),
    ).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK', extra: { available: 5 } });
    expect(inventoryModel.setStock).not.toHaveBeenCalled();
    expect(inventoryModel.insertMovement).not.toHaveBeenCalled();
  });

  test('bloquea_la_refaccion_antes_de_calcular_y_responde_404_si_no_existe', async () => {
    const { servicio, inventoryModel } = crearEntorno(null);
    await expect(servicio.applyMovement(conexion, { partId: 9, type: 'IN', delta: 1, reason: 'x', userId: 1 })).rejects.toMatchObject({
      status: 404,
    });
    expect(inventoryModel.lockPart).toHaveBeenCalledWith(conexion, 9);
  });

  test('vincula_el_movimiento_con_la_orden_cuando_se_indica', async () => {
    const { servicio, inventoryModel } = crearEntorno();
    await servicio.applyMovement(conexion, { partId: 4, type: 'OUT', delta: -1, reason: 'Uso', orderId: 12, userId: 1 });
    expect(inventoryModel.insertMovement.mock.calls[0][1].orderId).toBe(12);
  });

  test('deltaDe_aplica_el_signo_solo_a_las_salidas', () => {
    const { servicio } = crearEntorno();
    expect(servicio.deltaDe({ type: 'IN', quantity: 3 })).toBe(3);
    expect(servicio.deltaDe({ type: 'OUT', quantity: 3 })).toBe(-3);
    expect(servicio.deltaDe({ type: 'ADJUSTMENT', quantity: -3 })).toBe(-3);
    expect(servicio.deltaDe({ type: 'ADJUSTMENT', quantity: 3 })).toBe(3);
  });
});
