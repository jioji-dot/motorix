// Clasificación de mantenimientos programados: función pura, sin acceso a la base de datos.
// Reglas (data-model.md): VENCIDO si la fecha ya pasó o el kilometraje actual alcanzó el próximo;
// PROXIMO si faltan 15 días o menos, o 500 km o menos; NORMAL en otro caso. Con ambos valores gana el más urgente.
import {
  MAINTENANCE_CLASS,
  MAINTENANCE_WARNING_DAYS,
  MAINTENANCE_WARNING_KM,
} from '../utils/constants.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
// Para ordenar por urgencia valores en unidades distintas se asume una equivalencia de 50 km por día.
const KM_POR_DIA = 50;

// Texto 'YYYY-MM-DD' (o Date) → número de días desde la época, sin efectos de zona horaria.
function aDias(valor) {
  if (valor instanceof Date) {
    return Math.floor(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()) / MS_POR_DIA);
  }
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / MS_POR_DIA);
}

// Fecha de hoy en hora local como 'YYYY-MM-DD'.
export function hoyLocal(ahora = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

// Devuelve { classification, daysLeft, kmLeft }; los valores faltantes son null y los vencidos, negativos.
export function classify({ nextDate = null, nextMileage = null }, currentMileage, hoy = hoyLocal()) {
  const daysLeft = nextDate ? aDias(nextDate) - aDias(hoy) : null;
  const kmLeft = nextMileage !== null && nextMileage !== undefined ? nextMileage - currentMileage : null;

  let classification = MAINTENANCE_CLASS.NORMAL;
  if ((daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft <= 0)) {
    classification = MAINTENANCE_CLASS.OVERDUE;
  } else if (
    (daysLeft !== null && daysLeft <= MAINTENANCE_WARNING_DAYS) ||
    (kmLeft !== null && kmLeft <= MAINTENANCE_WARNING_KM)
  ) {
    classification = MAINTENANCE_CLASS.SOON;
  }
  return { classification, daysLeft, kmLeft };
}

const ORDEN_DE_CLASE = { [MAINTENANCE_CLASS.OVERDUE]: 0, [MAINTENANCE_CLASS.SOON]: 1, [MAINTENANCE_CLASS.NORMAL]: 2 };

// Valor de urgencia (menor = más urgente): el menor entre los días restantes y los kilómetros equivalentes en días.
export function urgency({ daysLeft, kmLeft }) {
  const valores = [];
  if (daysLeft !== null) valores.push(daysLeft);
  if (kmLeft !== null) valores.push(kmLeft / KM_POR_DIA);
  return valores.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...valores);
}

// Comparador: Vencido, Próximo, Normal y, dentro de cada grupo, el más urgente primero.
export function compareByUrgency(a, b) {
  return (
    ORDEN_DE_CLASE[a.classification] - ORDEN_DE_CLASE[b.classification] ||
    urgency(a) - urgency(b) ||
    a.id - b.id
  );
}
