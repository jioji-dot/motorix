// Estado de existencia de una refacción: reglas puras, sin acceso a la base de datos (D10).
//   OUT  → existencia en cero (agotada)
//   LOW  → existencia mayor a cero e igual o menor al mínimo (stock bajo)
//   OK   → existencia por encima del mínimo
import { STOCK_STATUS } from '../config/constants.js';

export function getStockStatus({ stock, minimumStock }) {
  const existencia = Number(stock);
  const minimo = Number(minimumStock);
  if (existencia === 0) return STOCK_STATUS.OUT;
  if (existencia <= minimo) return STOCK_STATUS.LOW;
  return STOCK_STATUS.OK;
}

/** Una refacción está en alerta cuando su stock es bajo o está agotada. */
export function isAlert(part) {
  return getStockStatus(part) !== STOCK_STATUS.OK;
}
