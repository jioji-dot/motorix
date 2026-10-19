// Regla central del inventario: todo cambio de stock ocurre en una transacción que bloquea la refacción,
// valida que el resultado no sea negativo e inserta un movimiento con el stock resultante.
import * as modeloInventario from '../models/inventoryModel.js';
import { MOVEMENT_TYPE } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

export function createInventoryService({ inventoryModel = modeloInventario } = {}) {
  // `delta` es el cambio de stock con signo. Debe llamarse dentro de una transacción.
  async function applyMovement(conexion, { partId, type, delta, reason, orderId = null, userId }) {
    const parte = await inventoryModel.lockPart(conexion, partId);
    if (!parte) throw HttpError.notFound('No se encontró la refacción solicitada.');

    const stockAfter = parte.stock + delta;
    if (stockAfter < 0) {
      throw new HttpError(
        409,
        'INSUFFICIENT_STOCK',
        `No hay existencias suficientes de "${parte.name}". Stock disponible: ${parte.stock}.`,
        undefined,
        { available: parte.stock },
      );
    }
    await inventoryModel.setStock(conexion, partId, stockAfter);
    const movementId = await inventoryModel.insertMovement(conexion, {
      partId,
      type,
      quantity: delta,
      stockAfter,
      reason,
      orderId,
      createdBy: userId,
    });
    return { movementId, stockAfter };
  }

  // Convierte la solicitud del administrador (cantidad positiva en IN/OUT y diferencia con signo en ADJUSTMENT) en un delta.
  function deltaDe({ type, quantity }) {
    return type === MOVEMENT_TYPE.OUT ? -quantity : quantity;
  }

  return { applyMovement, deltaDe };
}

export const inventoryService = createInventoryService();
