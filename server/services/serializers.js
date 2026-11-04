// Serializadores por rol: el servidor decide qué dinero recibe cada rol; ocultar datos en la interfaz no basta.
// - El precio de compra de una refacción solo lo ve el administrador.
// - El mecánico no recibe ningún precio ni importe de refacciones ni el total de la orden (Sprint 5, FR-008).
//   Los importes de servicios y mano de obra se conservan.

const esMecanico = (usuario) => usuario?.role === 'MECHANIC';

export function serializePart(parte, usuario) {
  if (!parte) return parte;
  if (usuario?.role === 'ADMIN') return parte;
  const visible = { ...parte };
  delete visible.purchasePrice;
  if (esMecanico(usuario)) delete visible.salePrice;
  return visible;
}

// Línea de refacción de una orden: sin precio unitario ni importe.
function lineaSinPrecios(linea) {
  const visible = { ...linea };
  delete visible.unitPrice;
  delete visible.amount;
  return visible;
}

// Orden (detalle, listado o entrada del historial del vehículo): al mecánico se le quita el total y el precio y el
// importe de cada línea de refacción. No modifica el original.
export function serializeOrder(orden, usuario) {
  if (!orden || !esMecanico(usuario)) return orden;
  const visible = { ...orden };
  delete visible.total;
  if (Array.isArray(visible.parts)) visible.parts = visible.parts.map(lineaSinPrecios);
  return visible;
}

export const serializeOrderListItem = serializeOrder;
export const serializeHistoryItem = serializeOrder;
