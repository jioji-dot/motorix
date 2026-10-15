// Reglas de negocio del catálogo de refacciones e inventario (US5, US6, US8).
// La existencia solo cambia mediante movimientos (partModel.applyMovement).
import { withTransaction } from '../config/database.js';
import { MOVEMENT_TYPE } from '../config/constants.js';
import * as partModel from '../models/partModel.js';
import { errors } from '../utils/AppError.js';
import { normalizePagination } from '../utils/normalizers.js';

const INITIAL_STOCK_REASON = 'Existencia inicial';

async function loadPart(id, db) {
  const pieza = await partModel.findById(id, db);
  if (!pieza) throw errors.notFound('La refacción no existe.');
  return pieza;
}

/** Alta de refacción; con existencia inicial registra un movimiento de entrada (FR-012). */
export async function createPart(user, datos) {
  if (await partModel.findByCode(datos.code)) throw errors.partCodeDuplicate();

  const id = await withTransaction(async (conn) => {
    const nuevoId = await partModel.insert(
      {
        code: datos.code,
        name: datos.name,
        description: datos.description ?? null,
        price: datos.price,
        minimumStock: datos.minimumStock ?? 0
      },
      conn
    );
    if ((datos.initialStock ?? 0) > 0) {
      await partModel.applyMovement(
        {
          partId: nuevoId,
          type: MOVEMENT_TYPE.IN,
          quantity: datos.initialStock,
          reason: INITIAL_STOCK_REASON,
          createdBy: user.id
        },
        conn
      );
    }
    return nuevoId;
  });
  return partModel.findById(id);
}

export async function getPart(id) {
  return loadPart(id);
}

export async function listParts({ search, active, alert, page, pageSize }) {
  const paginacion = normalizePagination({ page, pageSize });
  const { rows, total } = await partModel.list({
    search: search || undefined,
    active,
    alert,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return { items: rows, total, page: paginacion.page, pageSize: paginacion.pageSize };
}

/** Edita datos del catálogo. El cambio de precio no afecta a las órdenes ya capturadas. */
export async function updatePart(id, datos) {
  await loadPart(id);
  if (datos.code !== undefined) {
    const existente = await partModel.findByCode(datos.code);
    if (existente && existente.id !== id) throw errors.partCodeDuplicate();
  }
  await partModel.update(id, datos);
  return partModel.findById(id);
}

/** Baja o reactivación lógica (nunca se elimina una refacción); es idempotente. */
export async function setPartActive(id, active) {
  await loadPart(id);
  await partModel.setActive(id, active);
  return partModel.findById(id);
}

/** Entrada de mercancía: suma la cantidad y registra un movimiento IN (FR-016). */
export async function registerEntry(user, id, { quantity, reason }) {
  await loadPart(id);
  const movementId = await withTransaction(async (conn) => {
    await partModel.findByIdForUpdate(id, conn);
    return partModel.applyMovement(
      { partId: id, type: MOVEMENT_TYPE.IN, quantity, reason, createdBy: user.id },
      conn
    );
  });
  return { part: await partModel.findById(id), movement: await partModel.findMovementById(movementId) };
}

/**
 * Ajuste por conteo físico: deja la existencia en `newStock` registrando la diferencia con signo
 * como movimiento ADJUSTMENT. Un ajuste sin diferencia se rechaza (FR-016).
 */
export async function registerAdjustment(user, id, { newStock, reason }) {
  await loadPart(id);
  const movementId = await withTransaction(async (conn) => {
    const pieza = await partModel.findByIdForUpdate(id, conn);
    const diferencia = newStock - pieza.stock;
    if (diferencia === 0) {
      throw errors.validation('El ajuste no cambia la existencia actual.', [
        { field: 'newStock', message: `La existencia contada es igual a la actual (${pieza.stock}).` }
      ]);
    }
    return partModel.applyMovement(
      { partId: id, type: MOVEMENT_TYPE.ADJUSTMENT, quantity: diferencia, reason, createdBy: user.id },
      conn
    );
  });
  return { part: await partModel.findById(id), movement: await partModel.findMovementById(movementId) };
}

export async function listMovements(id, { page, pageSize }) {
  await loadPart(id);
  const paginacion = normalizePagination({ page, pageSize });
  const { rows, total } = await partModel.listMovements(id, {
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return { items: rows, total, page: paginacion.page, pageSize: paginacion.pageSize };
}

/** Búsqueda para que el mecánico agregue refacciones a sus órdenes (solo datos públicos). */
export async function searchAvailableParts({ search, limit }) {
  return partModel.searchAvailable({ search, limit: limit ?? 20 });
}

/** Conteo de alertas de existencia para la insignia del menú del administrador (FR-018). */
export async function getAlerts() {
  return partModel.countAlerts();
}
