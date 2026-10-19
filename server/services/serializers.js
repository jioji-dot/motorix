// Serializadores por rol: el precio de compra solo lo ve el administrador (el servidor no lo envía a otros roles).
export function serializePart(parte, usuario) {
  if (!parte) return parte;
  if (usuario?.role === 'ADMIN') return parte;
  const visible = { ...parte };
  delete visible.purchasePrice;
  return visible;
}
