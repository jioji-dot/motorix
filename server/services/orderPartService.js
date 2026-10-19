// Refacciones usadas en una orden. Cada alta, cambio de cantidad o baja genera sus movimientos de inventario
// en la misma transacción. Orden de bloqueo fijo: primero la orden y después la refacción.
import { withTransaction } from '../config/db.js';
import * as modeloInventario from '../models/inventoryModel.js';
import * as modeloLineas from '../models/orderPartModel.js';
import * as modeloOrdenes from '../models/orderModel.js';
import { MOVEMENT_TYPE, ORDER_OPEN_STATUSES } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { inventoryService as servicioInventario } from './inventoryService.js';

export function createOrderPartService({
  orderModel = modeloOrdenes,
  orderPartModel = modeloLineas,
  inventoryModel = modeloInventario,
  inventoryService = servicioInventario,
  transaction = withTransaction,
} = {}) {
  // Mismas reglas que el resto del trabajo documentado: mecánico asignado o administrador, con la orden en curso.
  async function abrirOrden(conexion, id, usuario) {
    const orden = await orderModel.lockOrder(conexion, id);
    if (!orden) throw HttpError.notFound('No se encontró la orden solicitada.');
    const esAsignado = usuario.role === 'MECHANIC' && orden.mechanicId === usuario.id;
    if (usuario.role !== 'ADMIN' && !esAsignado) {
      throw HttpError.forbidden('Solo el mecánico asignado o el administrador pueden documentar el trabajo de esta orden.');
    }
    if (!ORDER_OPEN_STATUSES.includes(orden.status)) {
      throw new HttpError(409, 'ORDER_NOT_EDITABLE', 'La orden ya no está en curso y no admite cambios en el trabajo documentado.');
    }
    return orden;
  }

  const movimiento = (conexion, orden, usuario, partId, type, delta, reason) =>
    inventoryService.applyMovement(conexion, { partId, type, delta, reason, orderId: orden.id, userId: usuario.id });

  async function add(orderId, { partId, quantity }, usuario) {
    await transaction(async (conexion) => {
      const orden = await abrirOrden(conexion, orderId, usuario);
      const parte = await inventoryModel.lockPart(conexion, partId);
      if (!parte) throw HttpError.notFound('No se encontró la refacción indicada.');
      if (!parte.active) {
        throw new HttpError(409, 'PART_INACTIVE', `La refacción "${parte.name}" está desactivada y no se puede usar.`);
      }
      if (await orderPartModel.findByOrderAndPart(conexion, orderId, partId)) {
        throw new HttpError(
          409,
          'DUPLICATE_ORDER_PART',
          'Esa refacción ya está en la orden. Edita su cantidad en lugar de agregarla otra vez.',
        );
      }
      await movimiento(conexion, orden, usuario, partId, MOVEMENT_TYPE.OUT, -quantity, `Uso en la orden ${orden.folio}`);
      // El precio se fija con el de venta vigente y se conserva aunque el catálogo cambie después.
      await orderPartModel.add(conexion, {
        orderId,
        partId,
        partCode: parte.code,
        partName: parte.name,
        quantity,
        unitPrice: parte.salePrice,
      });
      await orderModel.recalculateTotal(conexion, orderId);
    });
  }

  async function update(orderId, lineId, { quantity }, usuario) {
    await transaction(async (conexion) => {
      const orden = await abrirOrden(conexion, orderId, usuario);
      const linea = await orderPartModel.lockLine(conexion, orderId, lineId);
      if (!linea) throw HttpError.notFound('No se encontró la refacción indicada en esta orden.');
      const diferencia = quantity - linea.quantity;
      if (diferencia !== 0) {
        if (diferencia > 0) {
          const parte = await inventoryModel.lockPart(conexion, linea.partId);
          if (!parte.active) {
            throw new HttpError(409, 'PART_INACTIVE', `La refacción "${parte.name}" está desactivada y no se puede usar.`);
          }
          await movimiento(conexion, orden, usuario, linea.partId, MOVEMENT_TYPE.OUT, -diferencia, `Aumento de cantidad en la orden ${orden.folio}`);
        } else {
          await movimiento(conexion, orden, usuario, linea.partId, MOVEMENT_TYPE.IN, -diferencia, `Reversa por reducción de cantidad en la orden ${orden.folio}`);
        }
        await orderPartModel.setQuantity(conexion, lineId, quantity);
        await orderModel.recalculateTotal(conexion, orderId);
      }
    });
  }

  async function remove(orderId, lineId, usuario) {
    await transaction(async (conexion) => {
      const orden = await abrirOrden(conexion, orderId, usuario);
      const linea = await orderPartModel.lockLine(conexion, orderId, lineId);
      if (!linea) throw HttpError.notFound('No se encontró la refacción indicada en esta orden.');
      await movimiento(conexion, orden, usuario, linea.partId, MOVEMENT_TYPE.IN, linea.quantity, `Reversa por quitar la refacción de la orden ${orden.folio}`);
      await orderPartModel.remove(conexion, lineId);
      await orderModel.recalculateTotal(conexion, orderId);
    });
  }

  return { add, update, remove };
}

export const orderPartService = createOrderPartService();
