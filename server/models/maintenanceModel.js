// Acceso a datos de `maintenance`. Solo consultas SQL; las reglas de negocio viven en services/.
// La clasificación (vencido, próximo, lejano) se calcula al consultar con utils/maintenanceStatus.js
// y nunca se guarda (D4).
import { pool } from '../config/database.js';
import { MAINTENANCE_STATUS } from '../config/constants.js';
import { escapeLike } from '../utils/normalizers.js';
import { classifyMaintenance, remaining } from '../utils/maintenanceStatus.js';

const MAINTENANCE_SELECT = `
  SELECT mt.id, mt.vehicle_id, mt.order_id, mt.description,
         DATE_FORMAT(mt.next_date, '%Y-%m-%d') AS next_date, mt.next_mileage, mt.status,
         mt.completed_at, mt.created_at,
         v.license_plate, v.brand, v.model, v.current_mileage,
         c.id AS client_id, c.name AS client_name, c.phone AS client_phone,
         o.folio AS order_folio, o.mechanic_id AS order_mechanic_id
  FROM maintenance mt
  JOIN vehicles v ON v.id = mt.vehicle_id
  JOIN clients c ON c.id = v.client_id
  JOIN service_orders o ON o.id = mt.order_id`;

/**
 * Convierte una fila al formato del contrato. `today` es el día local `YYYY-MM-DD` y
 * `thresholds` los umbrales de aviso vigentes (`warningDays`, `warningKm`).
 */
export function mapMaintenance(fila, { today, thresholds }) {
  if (!fila) return null;
  const referencias = {
    nextDate: fila.next_date,
    nextMileage: fila.next_mileage,
    currentMileage: fila.current_mileage,
    today
  };
  const pendiente = fila.status === MAINTENANCE_STATUS.PENDING;
  const restante = pendiente ? remaining(referencias) : { daysRemaining: null, kmRemaining: null };
  return {
    id: fila.id,
    vehicleId: fila.vehicle_id,
    vehiclePlate: fila.license_plate,
    vehicleTitle: `${fila.brand} ${fila.model}`,
    clientId: fila.client_id,
    clientName: fila.client_name,
    clientPhone: fila.client_phone,
    orderId: fila.order_id,
    orderFolio: fila.order_folio,
    description: fila.description,
    nextDate: fila.next_date,
    nextMileage: fila.next_mileage,
    currentMileage: fila.current_mileage,
    status: fila.status,
    classification: classifyMaintenance({
      status: fila.status,
      ...referencias,
      warningDays: thresholds.warningDays,
      warningKm: thresholds.warningKm
    }),
    daysRemaining: restante.daysRemaining,
    kmRemaining: restante.kmRemaining,
    completedAt: fila.completed_at,
    createdAt: fila.created_at
  };
}

export async function insert(datos, db = pool) {
  const [resultado] = await db.query(
    `INSERT INTO maintenance (vehicle_id, order_id, description, next_date, next_mileage, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      datos.vehicleId,
      datos.orderId,
      datos.description,
      datos.nextDate ?? null,
      datos.nextMileage ?? null,
      datos.createdBy
    ]
  );
  return resultado.insertId;
}

/** Fila cruda del mantenimiento (incluye `order_mechanic_id` para decidir permisos). */
export async function findRowById(id, db = pool) {
  const [filas] = await db.query(`${MAINTENANCE_SELECT} WHERE mt.id = ? LIMIT 1`, [id]);
  return filas[0] ?? null;
}

/** Mantenimiento pendiente del vehículo, bloqueado para la transacción en curso. */
export async function findPendingRowByVehicleForUpdate(vehicleId, db) {
  const [filas] = await db.query(
    `${MAINTENANCE_SELECT} WHERE mt.vehicle_id = ? AND mt.status = 'PENDIENTE' LIMIT 1 FOR UPDATE`,
    [vehicleId]
  );
  return filas[0] ?? null;
}

/** El pendiente primero y luego los cerrados, del más reciente al más antiguo. */
export async function listRowsByVehicle(vehicleId, db = pool) {
  const [filas] = await db.query(
    `${MAINTENANCE_SELECT} WHERE mt.vehicle_id = ?
     ORDER BY (mt.status = 'PENDIENTE') DESC, mt.created_at DESC, mt.id DESC`,
    [vehicleId]
  );
  return filas;
}

/** Actualiza solo los campos recibidos; `null` quita la fecha o el kilometraje. */
export async function update(id, { description, nextDate, nextMileage }, db = pool) {
  const columnas = [];
  const parametros = [];
  if (description !== undefined) {
    columnas.push('description = ?');
    parametros.push(description);
  }
  if (nextDate !== undefined) {
    columnas.push('next_date = ?');
    parametros.push(nextDate);
  }
  if (nextMileage !== undefined) {
    columnas.push('next_mileage = ?');
    parametros.push(nextMileage);
  }
  if (columnas.length === 0) return;
  await db.query(`UPDATE maintenance SET ${columnas.join(', ')} WHERE id = ?`, [...parametros, id]);
}

/** Cierra el mantenimiento (REALIZADO o CANCELADO) y registra cuándo. */
export async function close(id, status, db = pool) {
  await db.query('UPDATE maintenance SET status = ?, completed_at = NOW() WHERE id = ?', [status, id]);
}

/** ¿El mecánico tiene alguna orden asignada para este vehículo? (lectura del detalle) */
export async function mechanicWorkedVehicle(mechanicId, vehicleId, db = pool) {
  const [filas] = await db.query(
    'SELECT 1 FROM service_orders WHERE mechanic_id = ? AND vehicle_id = ? LIMIT 1',
    [mechanicId, vehicleId]
  );
  return filas.length > 0;
}

// Expresiones de clasificación en SQL; deben coincidir con utils/maintenanceStatus.js (D4).
// Se usa CAST a SIGNED porque las columnas de kilometraje son UNSIGNED y la resta podría desbordar.
const SQL_VENCIDO = `(
  (mt.next_date IS NOT NULL AND mt.next_date < :today)
  OR (mt.next_mileage IS NOT NULL AND CAST(mt.next_mileage AS SIGNED) < CAST(v.current_mileage AS SIGNED))
)`;
const SQL_PROXIMO = `(
  (mt.next_date IS NOT NULL AND DATEDIFF(mt.next_date, :today) <= :warningDays)
  OR (mt.next_mileage IS NOT NULL
      AND CAST(mt.next_mileage AS SIGNED) - CAST(v.current_mileage AS SIGNED) <= :warningKm)
)`;
// 0 = vencido, 1 = próximo, 2 = lejano (solo tiene sentido en los pendientes).
const SQL_RANGO = `(CASE WHEN ${SQL_VENCIDO} THEN 0 WHEN ${SQL_PROXIMO} THEN 1 ELSE 2 END)`;

/**
 * Listado para avisar a los clientes (US4). Por omisión (`classification` = ALERT) devuelve los
 * pendientes vencidos y próximos, los vencidos primero y luego por cercanía. Con `status` devuelve
 * ese estado sin importar la clasificación.
 * @param {{ classification?: 'OVERDUE'|'UPCOMING'|'ALERT', status?: string, search?: string,
 *   today: string, thresholds: { warningDays: number, warningKm: number }, limit: number, offset: number }} opciones
 */
export async function listForAlerts(
  { classification = 'ALERT', status, search, today, thresholds, limit, offset },
  db = pool
) {
  const parametros = {
    today,
    warningDays: thresholds.warningDays,
    warningKm: thresholds.warningKm
  };
  const condiciones = [];

  if (status) {
    condiciones.push('mt.status = :status');
    parametros.status = status;
  } else {
    condiciones.push("mt.status = 'PENDIENTE'");
    if (classification === 'OVERDUE') condiciones.push(SQL_VENCIDO);
    else if (classification === 'UPCOMING') condiciones.push(`NOT ${SQL_VENCIDO} AND ${SQL_PROXIMO}`);
    else condiciones.push(`(${SQL_VENCIDO} OR ${SQL_PROXIMO})`);
  }

  if (search) {
    parametros.patron = `%${escapeLike(search)}%`;
    parametros.patronPlaca = `%${escapeLike(search.replace(/[\s-]+/g, '').toUpperCase())}%`;
    condiciones.push('(c.name LIKE :patron OR v.license_plate LIKE :patron OR v.license_plate LIKE :patronPlaca)');
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;
  const orden = status && status !== 'PENDIENTE'
    ? 'ORDER BY mt.completed_at DESC, mt.id DESC'
    : `ORDER BY ${SQL_RANGO} ASC,
         COALESCE(DATEDIFF(mt.next_date, :today), 999999) ASC,
         COALESCE(CAST(mt.next_mileage AS SIGNED) - CAST(v.current_mileage AS SIGNED), 999999999) ASC,
         mt.id ASC`;

  const [[{ total }]] = await db.query(
    { sql: `SELECT COUNT(*) AS total FROM maintenance mt
            JOIN vehicles v ON v.id = mt.vehicle_id JOIN clients c ON c.id = v.client_id ${where}`, namedPlaceholders: true },
    parametros
  );
  const [filas] = await db.query(
    { sql: `${MAINTENANCE_SELECT} ${where} ${orden} LIMIT :limit OFFSET :offset`, namedPlaceholders: true },
    { ...parametros, limit, offset }
  );
  return { rows: filas, total };
}

/**
 * Cuenta los mantenimientos pendientes vencidos y próximos con las mismas expresiones y umbrales del
 * listado de avisos (`listForAlerts`), para que el panel y el módulo nunca difieran.
 * @returns {Promise<{ overdue: number, upcoming: number }>}
 */
export async function countByClassification({ today, thresholds }, db = pool) {
  const [[fila]] = await db.query(
    {
      sql: `SELECT
              COALESCE(SUM(${SQL_VENCIDO}), 0) AS overdue,
              COALESCE(SUM(NOT ${SQL_VENCIDO} AND ${SQL_PROXIMO}), 0) AS upcoming
            FROM maintenance mt
            JOIN vehicles v ON v.id = mt.vehicle_id
            WHERE mt.status = 'PENDIENTE'`,
      namedPlaceholders: true
    },
    { today, warningDays: thresholds.warningDays, warningKm: thresholds.warningKm }
  );
  return { overdue: Number(fila.overdue), upcoming: Number(fila.upcoming) };
}
