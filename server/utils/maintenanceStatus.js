// Clasificación de mantenimientos: reglas puras, sin acceso a la base de datos (D4).
//   OVERDUE  → la fecha ya pasó (hoy es posterior) o el kilometraje actual superó el objetivo
//   UPCOMING → faltan `warningDays` días o menos, o `warningKm` km o menos (incluye "hoy" y "ahora")
//   LATER    → el resto
// Solo se clasifican los mantenimientos PENDIENTES; los cerrados devuelven null.
import { MAINTENANCE_CLASSIFICATION as C, MAINTENANCE_STATUS } from '../config/constants.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Convierte `YYYY-MM-DD` o Date a un día absoluto (sin zona horaria) para restar fechas. */
function toDayNumber(valor) {
  if (valor instanceof Date) {
    return Math.floor(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()) / MS_POR_DIA);
  }
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / MS_POR_DIA);
}

/** Días y kilómetros que faltan (negativos si ya venció); null si no hay ese dato. */
export function remaining({ nextDate, nextMileage, currentMileage, today }) {
  return {
    daysRemaining: nextDate ? toDayNumber(nextDate) - toDayNumber(today) : null,
    kmRemaining: nextMileage != null ? Number(nextMileage) - Number(currentMileage) : null
  };
}

export function classifyMaintenance({
  status = MAINTENANCE_STATUS.PENDING,
  nextDate,
  nextMileage,
  currentMileage,
  today,
  warningDays,
  warningKm
}) {
  if (status !== MAINTENANCE_STATUS.PENDING) return null;
  const { daysRemaining, kmRemaining } = remaining({ nextDate, nextMileage, currentMileage, today });

  if ((daysRemaining != null && daysRemaining < 0) || (kmRemaining != null && kmRemaining < 0)) {
    return C.OVERDUE;
  }
  if (
    (daysRemaining != null && daysRemaining <= warningDays) ||
    (kmRemaining != null && kmRemaining <= warningKm)
  ) {
    return C.UPCOMING;
  }
  return C.LATER;
}
