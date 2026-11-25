// Acceso a datos de tickets y de la información que se necesita para armar su contenido.
import crypto from 'node:crypto';
import { pool } from '../config/db.js';

export function folioDe(id) {
  return `TK-${String(id).padStart(6, '0')}`;
}

// Bloquea la orden durante la transacción: serializa la generación del ticket de una misma orden.
export async function lockOrder(conexion, orderId) {
  await conexion.execute('SELECT id FROM service_orders WHERE id = ? FOR UPDATE', [orderId]);
}

export async function findByOrder(orderId, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT id, folio, orderId, paymentId, generatedBy, generatedAt,
            shopName, shopAddress, shopPhone, nextServiceName,
            DATE_FORMAT(nextServiceDate, '%Y-%m-%d') AS nextServiceDate, nextServiceMileage
       FROM tickets WHERE orderId = ?`,
    [orderId],
  );
  return filas[0] ?? null;
}

// Inserta el ticket y le asigna el folio a partir de su id (igual que las órdenes).
export async function create(conexion, { orderId, paymentId, generatedBy, workshop = null, nextService = null }) {
  const [resultado] = await conexion.execute(
    `INSERT INTO tickets (folio, orderId, paymentId, generatedBy, shopName, shopAddress, shopPhone,
                         nextServiceName, nextServiceDate, nextServiceMileage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `TMP-${crypto.randomUUID().slice(0, 15)}`, orderId, paymentId ?? null, generatedBy,
      workshop?.name ?? null, workshop?.address ?? null, workshop?.phone ?? null,
      nextService?.name ?? null, nextService?.date ?? null, nextService?.mileage ?? null,
    ],
  );
  const id = resultado.insertId;
  await conexion.execute('UPDATE tickets SET folio = ? WHERE id = ?', [folioDe(id), id]);
  return id;
}

export async function setPayment(conexion, id, paymentId) {
  await conexion.execute('UPDATE tickets SET paymentId = ? WHERE id = ?', [paymentId ?? null, id]);
}

// Último pago Pagado de la orden (el "pago principal" del ticket).
export async function lastPaidPaymentId(orderId, conexion = pool) {
  const [filas] = await conexion.execute(
    "SELECT id FROM payments WHERE orderId = ? AND status = 'PAGADO' ORDER BY id DESC LIMIT 1",
    [orderId],
  );
  return filas[0]?.id ?? null;
}

// Orden con cliente y vehículo.
export async function findOrderData(orderId, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT o.id, o.folio, o.status, o.total, o.entryMileage, o.serviceMileage, o.deliveredAt,
            c.name AS clientName, c.phone AS clientPhone, v.brand, v.model, v.year, v.licensePlate
       FROM service_orders o
       JOIN clients  c ON c.id = o.clientId
       JOIN vehicles v ON v.id = o.vehicleId
      WHERE o.id = ?`,
    [orderId],
  );
  return filas[0] ?? null;
}

// Líneas de la orden y pagos, para el contenido del ticket.
export async function findLines(orderId, conexion = pool) {
  const [services] = await conexion.execute('SELECT description, amount FROM order_services WHERE orderId = ? ORDER BY id', [orderId]);
  const [labor] = await conexion.execute(
    'SELECT description, hours, hourlyRate, amount FROM order_labor WHERE orderId = ? ORDER BY id',
    [orderId],
  );
  const [parts] = await conexion.execute(
    'SELECT partName AS name, quantity, unitPrice, amount FROM order_parts WHERE orderId = ? ORDER BY id',
    [orderId],
  );
  const [payments] = await conexion.execute('SELECT id, amount, method, status FROM payments WHERE orderId = ? ORDER BY id', [orderId]);
  return { services, labor, parts, payments };
}

// Tipos de servicio con intervalo enlazados a las líneas de servicio de la orden (para el próximo servicio del ticket).
export async function findServiceIntervals(orderId, conexion = pool) {
  const [filas] = await conexion.execute(
    `SELECT DISTINCT st.id, st.name, st.intervalDays, st.intervalKm
       FROM order_services os JOIN service_types st ON st.id = os.serviceTypeId
      WHERE os.orderId = ? ORDER BY st.id`,
    [orderId],
  );
  return filas;
}
