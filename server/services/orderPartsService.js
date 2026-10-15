// Refacciones utilizadas en una orden (US7). Cada cambio de cantidad genera su movimiento de
// inventario en la misma transacción (RN-6, RN-7) y nunca deja la existencia en negativo (RN-8).
//
// Orden de bloqueos (D7): primero la orden y después la refacción, siempre, para evitar
// interbloqueos entre operaciones concurrentes.
import { MOVEMENT_TYPE } from '../config/constants.js';
import { withTransaction } from '../config/database.js';
import * as orderModel from '../models/orderModel.js';
import * as partModel from '../models/partModel.js';
import { errors } from '../utils/AppError.js';
import { isWorkEditable } from '../utils/orderStatus.js';
import { buildOrderDetail } from './orderService.js';
import { loadForWork } from './orderWorkService.js';

const usoReason = (folio) => `Uso en la orden ${folio}`;
const devolucionReason = (folio) => `Devolución de la orden ${folio}`;

/** Quien puede documentar el trabajo ve la orden (404 si es ajena, 403 si no puede editar). */
async function loadOrder(user, id) {
  const orden = await loadForWork(user, id);
  if (!isWorkEditable(orden.status)) throw errors.orderNotEditable(orden.status);
  return orden;
}

/** Bloquea la orden y vuelve a comprobar su estado (pudo cambiar a TERMINADO entretanto). */
async function lockEditableOrder(id, conn) {
  const bloqueada = await orderModel.lockOrder(id, conn);
  if (!bloqueada) throw errors.notFound('La orden no existe.');
  if (!isWorkEditable(bloqueada.status)) throw errors.orderNotEditable(bloqueada.status);
}

const refresh = async (user, id) => buildOrderDetail(await orderModel.findOrderById(id), user);

/** Agrega una refacción; si ya está en la orden, suma la cantidad a la línea existente. */
export async function addPart(user, id, { partId, quantity }) {
  const orden = await loadOrder(user, id);

  await withTransaction(async (conn) => {
    await lockEditableOrder(id, conn);
    const pieza = await partModel.findByIdForUpdate(partId, conn);
    if (!pieza) throw errors.notFound('La refacción no existe.');
    if (!pieza.active) throw errors.partInactive();

    await partModel.applyMovement(
      {
        partId,
        type: MOVEMENT_TYPE.OUT,
        quantity: -quantity,
        reason: usoReason(orden.folio),
        orderId: id,
        createdBy: user.id
      },
      conn
    );

    const linea = await orderModel.findOrderPartByPartForUpdate(id, partId, conn);
    if (linea) {
      await orderModel.setOrderPartQuantity(linea.id, linea.quantity + quantity, conn);
    } else {
      await orderModel.insertOrderPart(
        { orderId: id, partId, quantity, unitPrice: pieza.price },
        conn
      );
    }
  });
  return refresh(user, id);
}

/** Cambia la cantidad de una línea: aumentar genera una salida; reducir, una devolución. */
export async function updatePartQuantity(user, id, orderPartId, { quantity }) {
  const orden = await loadOrder(user, id);

  await withTransaction(async (conn) => {
    await lockEditableOrder(id, conn);
    const linea = await orderModel.findOrderPartForUpdate(id, orderPartId, conn);
    if (!linea) throw errors.notFound('La refacción no existe en esta orden.');

    const diferencia = quantity - linea.quantity;
    if (diferencia === 0) return;

    const pieza = await partModel.findByIdForUpdate(linea.partId, conn);
    if (diferencia > 0 && !pieza.active) throw errors.partInactive();

    await partModel.applyMovement(
      {
        partId: linea.partId,
        type: diferencia > 0 ? MOVEMENT_TYPE.OUT : MOVEMENT_TYPE.IN,
        quantity: -diferencia,
        reason: diferencia > 0 ? usoReason(orden.folio) : devolucionReason(orden.folio),
        orderId: id,
        createdBy: user.id
      },
      conn
    );
    await orderModel.setOrderPartQuantity(linea.id, quantity, conn);
  });
  return refresh(user, id);
}

/** Quita la línea y devuelve al inventario toda su cantidad. */
export async function removePart(user, id, orderPartId) {
  const orden = await loadOrder(user, id);

  await withTransaction(async (conn) => {
    await lockEditableOrder(id, conn);
    const linea = await orderModel.findOrderPartForUpdate(id, orderPartId, conn);
    if (!linea) throw errors.notFound('La refacción no existe en esta orden.');

    await partModel.findByIdForUpdate(linea.partId, conn);
    await partModel.applyMovement(
      {
        partId: linea.partId,
        type: MOVEMENT_TYPE.IN,
        quantity: linea.quantity,
        reason: devolucionReason(orden.folio),
        orderId: id,
        createdBy: user.id
      },
      conn
    );
    await orderModel.deleteOrderPart(linea.id, conn);
  });
  return refresh(user, id);
}
