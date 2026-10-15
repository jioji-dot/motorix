// Máquina de estados de la orden de servicio: reglas puras, sin acceso a la base de datos.
// Transiciones válidas (FR-023):
//   RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO
//   EN_REPARACION ⇄ ESPERANDO_REFACCION
import { ORDER_STATUS as S, ROLES } from '../config/constants.js';

export const TRANSITIONS = Object.freeze({
  [S.RECEIVED]: [S.DIAGNOSIS],
  [S.DIAGNOSIS]: [S.IN_REPAIR],
  [S.IN_REPAIR]: [S.WAITING_PART, S.FINISHED],
  [S.WAITING_PART]: [S.IN_REPAIR],
  [S.FINISHED]: [S.DELIVERED],
  [S.DELIVERED]: []
});

/** Estados en los que se pueden editar el diagnóstico, los servicios y la mano de obra. */
const WORK_STATES = [S.RECEIVED, S.DIAGNOSIS, S.IN_REPAIR, S.WAITING_PART];

/** Estados válidos que siguen al estado indicado (vacío si el estado no existe). */
export function allowedTransitions(from) {
  return [...(TRANSITIONS[from] ?? [])];
}

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** El usuario es el mecánico asignado a la orden. */
export function isAssignedMechanic(user, order) {
  return (
    user?.role === ROLES.MECHANIC && order?.mechanicId != null && order.mechanicId === user.id
  );
}

/**
 * Quién puede ejecutar una transición (FR-025):
 * - hasta TERMINADO: el administrador o el mecánico asignado;
 * - ENTREGADO: la recepcionista o el administrador.
 */
export function canRoleTransition({ user, order, to }) {
  if (!user) return false;
  if (to === S.DELIVERED) {
    return user.role === ROLES.ADMIN || user.role === ROLES.RECEPTIONIST;
  }
  return user.role === ROLES.ADMIN || isAssignedMechanic(user, order);
}

/** Transiciones que el usuario puede ejecutar ahora sobre la orden. */
export function allowedTransitionsFor({ user, order }) {
  return allowedTransitions(order.status).filter((to) => canRoleTransition({ user, order, to }));
}

/** Administrador o mecánico asignado: quienes documentan el trabajo técnico. */
export function canEditWork(user, order) {
  return user?.role === ROLES.ADMIN || isAssignedMechanic(user, order);
}

export function isWorkEditable(status) {
  return WORK_STATES.includes(status);
}

/** Observaciones y recomendaciones se pueden registrar hasta antes de ENTREGADO. */
export function isNotesEditable(status) {
  return status !== S.DELIVERED;
}

/** Problema reportado, mecánico asignado y kilometraje: hasta antes de TERMINADO. */
export function isBasicDataEditable(status) {
  return status !== S.FINISHED && status !== S.DELIVERED;
}
