// Historial de servicios de un vehículo: consulta derivada de las órdenes terminadas o entregadas.
// No existe una tabla propia (RN-10, D1): siempre refleja el estado actual de cada orden.
import { pool } from '../config/database.js';
import { ORDER_STATUS } from '../config/constants.js';

const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const ESTADOS_DEL_HISTORIAL = [ORDER_STATUS.FINISHED, ORDER_STATUS.DELIVERED];

export async function countHistory(vehicleId, db = pool) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM service_orders WHERE vehicle_id = ? AND status IN (?)',
    [vehicleId, ESTADOS_DEL_HISTORIAL]
  );
  return total;
}

/** Agrupa filas de líneas por identificador de orden. */
function agruparPorOrden(filas, mapear) {
  const grupos = new Map();
  for (const fila of filas) {
    if (!grupos.has(fila.order_id)) grupos.set(fila.order_id, []);
    grupos.get(fila.order_id).push(mapear(fila));
  }
  return grupos;
}

/**
 * Página del historial, de la más reciente a la más antigua. La fecha de servicio es la del
 * último cambio a TERMINADO; si no existe, la de creación de la orden. Los servicios, la mano de
 * obra y las refacciones de la página se consultan en bloque (sin consultas por orden).
 */
export async function listHistory(vehicleId, { limit, offset }, db = pool) {
  const [ordenes] = await db.query(
    `SELECT o.id, o.folio, o.status, o.entry_mileage, o.service_mileage, o.reported_problem,
            o.diagnosis, o.recommendations, m.name AS mechanic_name,
            COALESCE(
              (SELECT MAX(h.created_at) FROM order_status_history h
               WHERE h.order_id = o.id AND h.to_status = 'TERMINADO'),
              o.created_at
            ) AS service_date
     FROM service_orders o
     LEFT JOIN users m ON m.id = o.mechanic_id
     WHERE o.vehicle_id = ? AND o.status IN (?)
     ORDER BY service_date DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [vehicleId, ESTADOS_DEL_HISTORIAL, limit, offset]
  );
  if (ordenes.length === 0) return [];

  const ids = ordenes.map((o) => o.id);
  const [servicios] = await db.query(
    'SELECT order_id, description, amount FROM order_services WHERE order_id IN (?) ORDER BY id',
    [ids]
  );
  const [manoDeObra] = await db.query(
    'SELECT order_id, description, hours, hourly_rate, amount FROM order_labor WHERE order_id IN (?) ORDER BY id',
    [ids]
  );
  const [refacciones] = await db.query(
    `SELECT op.order_id, p.code, p.name, op.quantity, op.unit_price, op.amount
     FROM order_parts op JOIN parts p ON p.id = op.part_id
     WHERE op.order_id IN (?) ORDER BY op.id`,
    [ids]
  );

  const serviciosPorOrden = agruparPorOrden(servicios, (f) => ({
    description: f.description,
    amount: Number(f.amount)
  }));
  const manoPorOrden = agruparPorOrden(manoDeObra, (f) => ({
    description: f.description,
    hours: Number(f.hours),
    hourlyRate: Number(f.hourly_rate),
    amount: Number(f.amount)
  }));
  const refaccionesPorOrden = agruparPorOrden(refacciones, (f) => ({
    code: f.code,
    name: f.name,
    quantity: f.quantity,
    unitPrice: Number(f.unit_price),
    amount: Number(f.amount)
  }));

  return ordenes.map((o) => {
    const services = serviciosPorOrden.get(o.id) ?? [];
    const labor = manoPorOrden.get(o.id) ?? [];
    const parts = refaccionesPorOrden.get(o.id) ?? [];
    const suma = (lineas) => lineas.reduce((acumulado, l) => acumulado + l.amount, 0);
    return {
      orderId: o.id,
      folio: o.folio,
      status: o.status,
      serviceDate: o.service_date,
      mileage: o.service_mileage ?? o.entry_mileage,
      mechanicName: o.mechanic_name,
      reportedProblem: o.reported_problem,
      diagnosis: o.diagnosis,
      recommendations: o.recommendations,
      services,
      labor,
      parts,
      total: redondear(suma(services) + suma(labor) + suma(parts))
    };
  });
}
