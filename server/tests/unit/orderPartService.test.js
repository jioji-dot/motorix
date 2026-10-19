import { jest } from '@jest/globals';
import { createOrderPartService } from '../../services/orderPartService.js';
import { orderPartSchema, updateOrderPartSchema } from '../../validators/partValidator.js';

const MECANICO = { id: 3, role: 'MECHANIC' };
const OTRO = { id: 4, role: 'MECHANIC' };
const RECEPCION = { id: 2, role: 'RECEPTIONIST' };
const ADMIN = { id: 1, role: 'ADMIN' };
const conexion = { id: 'conexion' };

function crearEntorno({
  orden = { id: 9, folio: 'OS-000009', status: 'EN_REPARACION', mechanicId: 3 },
  parte = { id: 7, code: 'FIL-1', name: 'Filtro', stock: 10, salePrice: '120.00', active: 1 },
  existente = null,
  linea = { id: 20, orderId: 9, partId: 7, quantity: 2 },
} = {}) {
  const orderModel = { lockOrder: jest.fn(async () => orden), recalculateTotal: jest.fn(async () => {}) };
  const inventoryModel = { lockPart: jest.fn(async () => parte) };
  const orderPartModel = {
    findByOrderAndPart: jest.fn(async () => existente),
    add: jest.fn(async () => 20),
    lockLine: jest.fn(async () => linea),
    setQuantity: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
  };
  const inventoryService = { applyMovement: jest.fn(async () => ({})) };
  const servicio = createOrderPartService({
    orderModel,
    orderPartModel,
    inventoryModel,
    inventoryService,
    transaction: async (trabajo) => trabajo(conexion),
  });
  return { servicio, orderModel, orderPartModel, inventoryService };
}

describe('Validación de refacciones en la orden', () => {
  test('la_cantidad_es_entera_de_1_a_1000000', () => {
    const con = (quantity) => orderPartSchema.safeParse({ partId: 1, quantity });
    expect(con(1).success).toBe(true);
    expect(con(1000000).success).toBe(true);
    expect(con(0).success).toBe(false);
    expect(con(1000001).success).toBe(false);
    expect(con(1.5).success).toBe(false);
    expect(updateOrderPartSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });

  test('descarta_cualquier_precio_enviado', () => {
    expect(orderPartSchema.parse({ partId: 1, quantity: 2, unitPrice: 1 })).toEqual({ partId: 1, quantity: 2 });
  });

  test('exige_la_refaccion', () => {
    expect(orderPartSchema.safeParse({ quantity: 2 }).success).toBe(false);
  });
});

describe('Servicio de refacciones en la orden', () => {
  test('agregar_registra_la_salida_ligada_a_la_orden_congela_el_precio_y_recalcula_el_total', async () => {
    const { servicio, inventoryService, orderPartModel, orderModel } = crearEntorno();
    await servicio.add(9, { partId: 7, quantity: 2 }, MECANICO);
    expect(inventoryService.applyMovement).toHaveBeenCalledWith(conexion, {
      partId: 7, type: 'OUT', delta: -2, reason: 'Uso en la orden OS-000009', orderId: 9, userId: 3,
    });
    expect(orderPartModel.add).toHaveBeenCalledWith(conexion, {
      orderId: 9, partId: 7, partCode: 'FIL-1', partName: 'Filtro', quantity: 2, unitPrice: '120.00',
    });
    expect(orderModel.recalculateTotal).toHaveBeenCalledWith(conexion, 9);
  });

  test('el_administrador_tambien_puede_agregar', async () => {
    const { servicio } = crearEntorno();
    await expect(servicio.add(9, { partId: 7, quantity: 1 }, ADMIN)).resolves.toBeUndefined();
  });

  test('otro_mecanico_y_recepcion_reciben_403_sin_mover_inventario', async () => {
    const { servicio, inventoryService } = crearEntorno();
    await expect(servicio.add(9, { partId: 7, quantity: 1 }, OTRO)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.add(9, { partId: 7, quantity: 1 }, RECEPCION)).rejects.toMatchObject({ status: 403 });
    expect(inventoryService.applyMovement).not.toHaveBeenCalled();
  });

  test('las_ordenes_cerradas_rechazan_cambios_con_ORDER_NOT_EDITABLE', async () => {
    for (const status of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      const { servicio, inventoryService } = crearEntorno({ orden: { id: 9, folio: 'OS-9', status, mechanicId: 3 } });
      await expect(servicio.add(9, { partId: 7, quantity: 1 }, MECANICO)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
      await expect(servicio.update(9, 20, { quantity: 1 }, MECANICO)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
      await expect(servicio.remove(9, 20, MECANICO)).rejects.toMatchObject({ code: 'ORDER_NOT_EDITABLE' });
      expect(inventoryService.applyMovement).not.toHaveBeenCalled();
    }
  });

  test('una_refaccion_inactiva_o_inexistente_se_rechaza', async () => {
    const inactiva = crearEntorno({ parte: { id: 7, name: 'Filtro', stock: 5, salePrice: '1.00', active: 0 } });
    await expect(inactiva.servicio.add(9, { partId: 7, quantity: 1 }, MECANICO)).rejects.toMatchObject({ code: 'PART_INACTIVE' });
    const inexistente = crearEntorno({ parte: null });
    await expect(inexistente.servicio.add(9, { partId: 7, quantity: 1 }, MECANICO)).rejects.toMatchObject({ status: 404 });
  });

  test('una_refaccion_ya_agregada_responde_DUPLICATE_ORDER_PART', async () => {
    const { servicio, inventoryService } = crearEntorno({ existente: { id: 20 } });
    await expect(servicio.add(9, { partId: 7, quantity: 1 }, MECANICO)).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_ORDER_PART' });
    expect(inventoryService.applyMovement).not.toHaveBeenCalled();
  });

  test('aumentar_la_cantidad_registra_solo_la_diferencia_como_salida', async () => {
    const { servicio, inventoryService, orderPartModel } = crearEntorno();
    await servicio.update(9, 20, { quantity: 5 }, MECANICO);
    expect(inventoryService.applyMovement.mock.calls[0][1]).toMatchObject({ type: 'OUT', delta: -3, partId: 7, orderId: 9 });
    expect(orderPartModel.setQuantity).toHaveBeenCalledWith(conexion, 20, 5);
  });

  test('reducir_la_cantidad_regresa_la_diferencia_como_entrada_de_reversa', async () => {
    const { servicio, inventoryService } = crearEntorno({ linea: { id: 20, orderId: 9, partId: 7, quantity: 5 } });
    await servicio.update(9, 20, { quantity: 2 }, MECANICO);
    expect(inventoryService.applyMovement.mock.calls[0][1]).toMatchObject({ type: 'IN', delta: 3 });
  });

  test('la_misma_cantidad_no_genera_movimientos', async () => {
    const { servicio, inventoryService, orderModel } = crearEntorno();
    await servicio.update(9, 20, { quantity: 2 }, MECANICO);
    expect(inventoryService.applyMovement).not.toHaveBeenCalled();
    expect(orderModel.recalculateTotal).not.toHaveBeenCalled();
  });

  test('quitar_regresa_todas_las_piezas_borra_la_linea_y_recalcula', async () => {
    const { servicio, inventoryService, orderPartModel, orderModel } = crearEntorno({ linea: { id: 20, orderId: 9, partId: 7, quantity: 4 } });
    await servicio.remove(9, 20, MECANICO);
    expect(inventoryService.applyMovement.mock.calls[0][1]).toMatchObject({ type: 'IN', delta: 4 });
    expect(orderPartModel.remove).toHaveBeenCalledWith(conexion, 20);
    expect(orderModel.recalculateTotal).toHaveBeenCalledWith(conexion, 9);
  });

  test('una_linea_que_no_es_de_la_orden_responde_404', async () => {
    const { servicio } = crearEntorno({ linea: null });
    await expect(servicio.update(9, 99, { quantity: 1 }, MECANICO)).rejects.toMatchObject({ status: 404 });
    await expect(servicio.remove(9, 99, MECANICO)).rejects.toMatchObject({ status: 404 });
  });

  test('la_orden_inexistente_responde_404', async () => {
    const { servicio } = crearEntorno({ orden: null });
    await expect(servicio.add(9, { partId: 7, quantity: 1 }, ADMIN)).rejects.toMatchObject({ status: 404 });
  });
});
