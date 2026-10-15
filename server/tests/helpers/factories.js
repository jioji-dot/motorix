// Fábricas de datos para pruebas de integración y contrato.
import { pool } from '../../config/database.js';
import { hashPassword } from '../../utils/password.js';
import { signToken } from '../../utils/token.js';

let contador = 0;
const siguiente = () => ++contador;

export const TEST_PASSWORD = 'Prueba2026!';

/** Crea un usuario con contraseña cifrada. Devuelve la fila insertada con la contraseña en claro. */
export async function createUser(overrides = {}) {
  const n = siguiente();
  const datos = {
    username: `usuario${n}`,
    name: `Usuario de prueba ${n}`,
    email: `usuario${n}@motorix.local`,
    role: 'RECEPTIONIST',
    active: 1,
    password: TEST_PASSWORD,
    ...overrides
  };
  const hash = await hashPassword(datos.password);
  const [resultado] = await pool.query(
    `INSERT INTO users (username, name, email, password_hash, role, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [datos.username, datos.name, datos.email, hash, datos.role, datos.active ? 1 : 0]
  );
  return { id: resultado.insertId, ...datos };
}

/** Token JWT válido para un usuario existente. */
export function tokenFor(user) {
  return signToken(user.id);
}

/** Crea un usuario del rol indicado y devuelve el usuario y su cabecera Authorization. */
export async function createAuthenticated(role = 'RECEPTIONIST', overrides = {}) {
  const user = await createUser({ role, ...overrides });
  return { user, auth: `Bearer ${tokenFor(user)}` };
}

export async function createClient(overrides = {}) {
  const n = siguiente();
  const datos = {
    name: `Cliente de prueba ${n}`,
    phone: `55${String(10000000 + n).slice(-8)}`,
    email: null,
    address: null,
    ...overrides
  };
  const [resultado] = await pool.query(
    'INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)',
    [datos.name, datos.phone, datos.email, datos.address]
  );
  return { id: resultado.insertId, ...datos };
}

/** Hora local de pared `YYYY-MM-DDTHH:mm`, a `diasAdelante` días de hoy y a la `hora` indicada. */
export function futureDateTime(diasAdelante = 1, hora = 10, minuto = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + diasAdelante);
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T${p(hora)}:${p(minuto)}`;
}

export function createMechanic(overrides = {}) {
  return createUser({ role: 'MECHANIC', ...overrides });
}

async function ensureUserId(userId, role = 'RECEPTIONIST') {
  if (userId) return userId;
  return (await createUser({ role })).id;
}

export async function createAppointment(clientId, vehicleId, overrides = {}) {
  const n = siguiente();
  const datos = {
    scheduledAt: futureDateTime(1 + (n % 20), 10),
    reason: `Revisión general ${n}`,
    notes: null,
    status: 'PENDIENTE',
    createdBy: null,
    ...overrides
  };
  const creador = await ensureUserId(datos.createdBy);
  const [resultado] = await pool.query(
    `INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, notes, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, vehicleId, datos.scheduledAt.replace('T', ' '), datos.reason, datos.notes, datos.status, creador]
  );
  return { id: resultado.insertId, clientId, vehicleId, ...datos, createdBy: creador };
}

// Camino normal de estados, para generar un historial coherente.
const CAMINO = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ENTREGADO'];

/**
 * Crea una orden en el estado indicado con folio e historial coherentes.
 * Si no se pasa `clientId`/`vehicleId` se crean automáticamente.
 */
export async function createOrder(overrides = {}) {
  const n = siguiente();
  const datos = {
    clientId: null,
    vehicleId: null,
    mechanicId: null,
    appointmentId: null,
    entryMileage: 1000,
    reportedProblem: `Falla de prueba ${n}`,
    diagnosis: null,
    notes: null,
    recommendations: null,
    status: 'RECIBIDO',
    createdBy: null,
    ...overrides
  };
  if (!datos.clientId) datos.clientId = (await createClient()).id;
  if (!datos.vehicleId) datos.vehicleId = (await createVehicle(datos.clientId)).id;
  const creador = await ensureUserId(datos.createdBy);

  const [resultado] = await pool.query(
    `INSERT INTO service_orders
       (appointment_id, client_id, vehicle_id, mechanic_id, entry_mileage, reported_problem,
        diagnosis, notes, recommendations, status, created_by, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.appointmentId,
      datos.clientId,
      datos.vehicleId,
      datos.mechanicId,
      datos.entryMileage,
      datos.reportedProblem,
      datos.diagnosis,
      datos.notes,
      datos.recommendations,
      datos.status,
      creador,
      datos.status === 'ENTREGADO' ? new Date() : null
    ]
  );
  const id = resultado.insertId;
  const folio = `OS-${String(id).padStart(6, '0')}`;
  await pool.query('UPDATE service_orders SET folio = ? WHERE id = ?', [folio, id]);

  const camino =
    datos.status === 'ESPERANDO_REFACCION'
      ? ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION']
      : CAMINO.slice(0, CAMINO.indexOf(datos.status) + 1);
  for (let i = 0; i < camino.length; i += 1) {
    await pool.query(
      'INSERT INTO order_status_history (order_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?)',
      [id, i === 0 ? null : camino[i - 1], camino[i], creador]
    );
  }
  return { id, folio, ...datos, createdBy: creador };
}

export async function createOrderService(orderId, overrides = {}) {
  const n = siguiente();
  const datos = { description: `Servicio ${n}`, amount: 100, ...overrides };
  const [resultado] = await pool.query(
    'INSERT INTO order_services (order_id, description, amount) VALUES (?, ?, ?)',
    [orderId, datos.description, datos.amount]
  );
  return { id: resultado.insertId, orderId, ...datos };
}

export async function createOrderLabor(orderId, overrides = {}) {
  const n = siguiente();
  const datos = { description: `Mano de obra ${n}`, hours: 1, hourlyRate: 200, ...overrides };
  const [resultado] = await pool.query(
    'INSERT INTO order_labor (order_id, description, hours, hourly_rate) VALUES (?, ?, ?, ?)',
    [orderId, datos.description, datos.hours, datos.hourlyRate]
  );
  return { id: resultado.insertId, orderId, ...datos };
}

export async function createVehicle(clientId, overrides = {}) {
  const n = siguiente();
  const datos = {
    brand: 'Nissan',
    model: 'Versa',
    year: 2020,
    licensePlate: `TST${String(1000 + n)}`,
    vin: null,
    color: null,
    currentMileage: 0,
    ...overrides
  };
  const [resultado] = await pool.query(
    `INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, color, current_mileage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clientId,
      datos.brand,
      datos.model,
      datos.year,
      datos.licensePlate,
      datos.vin,
      datos.color,
      datos.currentMileage
    ]
  );
  return { id: resultado.insertId, clientId, ...datos };
}

/** Crea una refacción. Con `stock` > 0 registra también el movimiento IN que lo respalda. */
export async function createPart(overrides = {}) {
  const n = siguiente();
  const datos = {
    code: `REF-${String(n).padStart(4, '0')}`,
    name: `Refacción de prueba ${n}`,
    description: null,
    price: 100,
    stock: 10,
    minimumStock: 2,
    active: 1,
    ...overrides
  };
  const [resultado] = await pool.query(
    `INSERT INTO parts (code, name, description, price, stock, minimum_stock, active)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [datos.code, datos.name, datos.description, datos.price, datos.minimumStock, datos.active ? 1 : 0]
  );
  const id = resultado.insertId;
  if (datos.stock > 0) {
    await createMovement(id, { type: 'IN', quantity: datos.stock, reason: 'Existencia inicial' });
  }
  return { id, ...datos };
}

/**
 * Inserta un movimiento y ajusta `parts.stock` con la misma regla del servicio.
 * `quantity` lleva signo (IN > 0, OUT < 0).
 */
export async function createMovement(partId, overrides = {}) {
  const datos = {
    type: 'IN',
    quantity: 1,
    reason: 'Movimiento de prueba',
    orderId: null,
    createdBy: null,
    ...overrides
  };
  const creador = await ensureUserId(datos.createdBy, 'ADMIN');
  const [resultado] = await pool.query(
    `INSERT INTO inventory_movements (part_id, type, quantity, reason, order_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [partId, datos.type, datos.quantity, datos.reason, datos.orderId, creador]
  );
  await pool.query('UPDATE parts SET stock = stock + ? WHERE id = ?', [datos.quantity, partId]);
  return { id: resultado.insertId, partId, ...datos, createdBy: creador };
}

/** Línea de refacción en una orden, sin movimiento de inventario (para armar escenarios). */
export async function createOrderPart(orderId, partId, overrides = {}) {
  const datos = { quantity: 1, unitPrice: 100, ...overrides };
  const [resultado] = await pool.query(
    'INSERT INTO order_parts (order_id, part_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
    [orderId, partId, datos.quantity, datos.unitPrice]
  );
  return { id: resultado.insertId, orderId, partId, ...datos };
}

/** Mantenimiento de un vehículo. Si no se pasa `orderId` se crea una orden terminada del vehículo. */
export async function createMaintenance(vehicleId, overrides = {}) {
  const n = siguiente();
  const datos = {
    orderId: null,
    description: `Mantenimiento de prueba ${n}`,
    nextDate: null,
    nextMileage: 20000,
    status: 'PENDIENTE',
    createdBy: null,
    ...overrides
  };
  if (!datos.orderId) {
    const [[vehiculo]] = await pool.query('SELECT client_id FROM vehicles WHERE id = ?', [vehicleId]);
    datos.orderId = (
      await createOrder({ clientId: vehiculo.client_id, vehicleId, status: 'TERMINADO' })
    ).id;
  }
  const creador = await ensureUserId(datos.createdBy);
  const [resultado] = await pool.query(
    `INSERT INTO maintenance (vehicle_id, order_id, description, next_date, next_mileage, status, completed_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vehicleId,
      datos.orderId,
      datos.description,
      datos.nextDate,
      datos.nextMileage,
      datos.status,
      datos.status === 'PENDIENTE' ? null : new Date(),
      creador
    ]
  );
  return { id: resultado.insertId, vehicleId, ...datos, createdBy: creador };
}

/**
 * Crea un pago de una orden (por omisión, efectivo aprobado de 100). Los de Mercado Pago llevan una
 * referencia externa única; no valida saldo (sirve para armar escenarios).
 */
export async function createPayment(orderId, overrides = {}) {
  const n = siguiente();
  const datos = {
    method: 'CASH',
    amount: 100,
    status: null,
    reference: null,
    externalReference: null,
    externalId: null,
    paymentUrl: null,
    voidReason: null,
    createdBy: null,
    ...overrides
  };
  if (datos.status === null) datos.status = datos.method === 'MERCADO_PAGO' ? 'PENDIENTE' : 'APROBADO';
  if (datos.method === 'MERCADO_PAGO' && !datos.externalReference) {
    datos.externalReference = `MTX-PRUEBA-${orderId}-${n}`;
  }
  const creador = await ensureUserId(datos.createdBy);
  const anulado = datos.status === 'ANULADO';
  const [resultado] = await pool.query(
    `INSERT INTO payments
       (order_id, method, amount, status, reference, external_reference, external_id, payment_url,
        void_reason, voided_by, voided_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      datos.method,
      datos.amount,
      datos.status,
      datos.reference,
      datos.externalReference,
      datos.externalId,
      datos.paymentUrl,
      anulado ? datos.voidReason ?? 'Anulado en la prueba' : null,
      anulado ? creador : null,
      anulado ? new Date() : null,
      creador
    ]
  );
  return { id: resultado.insertId, orderId, ...datos, createdBy: creador };
}

/** Crea el ticket de una orden con folio `TK-` + id con 6 dígitos. */
export async function createTicket(orderId, overrides = {}) {
  const creador = await ensureUserId(overrides.generatedBy ?? null);
  const [resultado] = await pool.query('INSERT INTO tickets (order_id, generated_by) VALUES (?, ?)', [
    orderId,
    creador
  ]);
  const id = resultado.insertId;
  const folio = `TK-${String(id).padStart(6, '0')}`;
  await pool.query('UPDATE tickets SET folio = ? WHERE id = ?', [folio, id]);
  return { id, folio, orderId, generatedBy: creador };
}
