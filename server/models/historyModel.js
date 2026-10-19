// Consultas del historial de servicios de un vehículo (vista calculada sobre las órdenes terminadas y entregadas).
import { pool } from '../config/db.js';

// Órdenes TERMINADO o ENTREGADO del vehículo, de la más reciente a la más antigua.
// La fecha del servicio es la del cambio a TERMINADO; el kilometraje, el del servicio o, si falta, el de entrada.
export async function listOrders(vehicleId, { page, pageSize }) {
  const [[{ total }]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM service_orders WHERE vehicleId = ? AND status IN ('TERMINADO','ENTREGADO')",
    [vehicleId],
  );
  const [filas] = await pool.query(
    `SELECT o.id, o.folio, o.status, o.diagnosis, o.notes, o.recommendations, o.total,
            COALESCE(o.serviceMileage, o.entryMileage) AS mileage,
            COALESCE((SELECT MAX(h.changedAt) FROM order_status_history h WHERE h.orderId = o.id AND h.toStatus = 'TERMINADO'),
                     o.updatedAt) AS serviceDate,
            m.id AS mechanicId, m.name AS mechanicName
       FROM service_orders o
       JOIN users m ON m.id = o.mechanicId
      WHERE o.vehicleId = ? AND o.status IN ('TERMINADO','ENTREGADO')
      ORDER BY serviceDate DESC, o.id DESC
      LIMIT ? OFFSET ?`,
    [vehicleId, pageSize, (page - 1) * pageSize],
  );
  return { filas, total };
}

// Carga por lotes (una consulta por tipo) las líneas de varias órdenes.
async function lineasDe(tabla, columnas, ids) {
  if (ids.length === 0) return [];
  const [filas] = await pool.query(`SELECT orderId, ${columnas} FROM ${tabla} WHERE orderId IN (?) ORDER BY id`, [ids]);
  return filas;
}

export const servicesOf = (ids) => lineasDe('order_services', 'id, description, amount', ids);
export const laborOf = (ids) => lineasDe('order_labor', 'id, description, hours, hourlyRate, amount', ids);
export const partsOf = (ids) =>
  lineasDe('order_parts', 'id, partId, partCode AS code, partName AS name, quantity, unitPrice, amount', ids);
