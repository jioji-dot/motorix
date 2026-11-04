// Lógica de negocio del catálogo de refacciones y de sus movimientos de inventario.
import { withTransaction } from '../config/db.js';
import * as modeloInventario from '../models/inventoryModel.js';
import * as modeloRefacciones from '../models/partModel.js';
import { MOVEMENT_TYPE } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { aCentavos, deCentavos } from '../utils/money.js';
import { inventoryService as servicioInventario } from './inventoryService.js';
import { serializePart } from './serializers.js';

export function createPartService({
  partModel = modeloRefacciones,
  inventoryModel = modeloInventario,
  inventoryService = servicioInventario,
  transaction = withTransaction,
} = {}) {
  async function exigirRefaccion(id) {
    const parte = await partModel.findById(id);
    if (!parte) throw HttpError.notFound('No se encontró la refacción solicitada.');
    return parte;
  }

  async function list(filtros, usuario) {
    // Quien no es administrador solo ve refacciones activas; el administrador ve todas salvo que filtre.
    const esAdmin = usuario.role === 'ADMIN';
    const active = esAdmin ? (filtros.active === 'all' ? undefined : filtros.active) : 'true';
    const { items, total } = await partModel.list({ ...filtros, active });
    return {
      items: items.map((parte) => serializePart(parte, usuario)),
      meta: { page: filtros.page, pageSize: filtros.pageSize, total },
    };
  }

  const summary = () => partModel.summary();
  const categories = () => partModel.categories();

  async function get(id, usuario) {
    const parte = await exigirRefaccion(id);
    if (!parte.active && usuario.role !== 'ADMIN') throw HttpError.notFound('No se encontró la refacción solicitada.');
    const { items } = await inventoryModel.listMovements(id, { page: 1, pageSize: 100 });
    return { ...serializePart(parte, usuario), movements: items };
  }

  // Venta menor al costo (FR-004): se guarda solo con una confirmación explícita; la confirmación no se almacena.
  function exigirConfirmacionSiVentaMenorAlCosto({ purchasePrice, salePrice }, confirmBelowCost) {
    if (aCentavos(salePrice) >= aCentavos(purchasePrice) || confirmBelowCost === true) return;
    throw new HttpError(409, 'PRICE_BELOW_COST', 'El precio de venta es menor al de compra. Confirma para guardar de todos modos.', [
      {
        field: 'salePrice',
        message: `La venta (${deCentavos(aCentavos(salePrice))}) es menor al costo (${deCentavos(aCentavos(purchasePrice))}).`,
      },
    ]);
  }

  async function create({ initialStock = 0, confirmBelowCost, ...datos }, usuario) {
    exigirConfirmacionSiVentaMenorAlCosto(datos, confirmBelowCost);
    if (await partModel.findByCode(datos.code)) {
      throw HttpError.duplicate('Ya existe una refacción con ese código.', [
        { field: 'code', message: 'Ya existe una refacción con ese código.' },
      ]);
    }
    const id = await transaction(async (conexion) => {
      const nuevoId = await partModel.create(conexion, datos);
      if (initialStock > 0) {
        await inventoryService.applyMovement(conexion, {
          partId: nuevoId,
          type: MOVEMENT_TYPE.IN,
          delta: initialStock,
          reason: 'Existencia inicial',
          userId: usuario.id,
        });
      }
      return nuevoId;
    });
    return serializePart(await partModel.findById(id), usuario);
  }

  async function update(id, { confirmBelowCost, ...datos }, usuario) {
    const parte = await exigirRefaccion(id);
    // Solo se vuelve a pedir confirmación si cambia algún precio: editar otros datos no la exige.
    if (datos.purchasePrice !== undefined || datos.salePrice !== undefined) {
      exigirConfirmacionSiVentaMenorAlCosto(
        { purchasePrice: datos.purchasePrice ?? parte.purchasePrice, salePrice: datos.salePrice ?? parte.salePrice },
        confirmBelowCost,
      );
    }
    await partModel.update(id, datos);
    return serializePart(await partModel.findById(id), usuario);
  }

  // Entrada, salida manual o ajuste (solo administrador). Devuelve el movimiento y la refacción actualizada.
  async function registerMovement(id, { type, quantity, reason }, usuario) {
    await exigirRefaccion(id);
    const { movementId } = await transaction((conexion) =>
      inventoryService.applyMovement(conexion, {
        partId: id,
        type,
        delta: inventoryService.deltaDe({ type, quantity }),
        reason,
        userId: usuario.id,
      }),
    );
    return {
      movement: await inventoryModel.findMovement(movementId),
      part: serializePart(await partModel.findById(id), usuario),
    };
  }

  async function listMovements(id, paginacion) {
    await exigirRefaccion(id);
    const { items, total } = await inventoryModel.listMovements(id, paginacion);
    return { items, meta: { ...paginacion, total } };
  }

  return { list, summary, categories, get, create, update, registerMovement, listMovements };
}

export const partService = createPartService();
