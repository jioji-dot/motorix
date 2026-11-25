// Bitácora de acciones sensibles. Cada acción tiene una lista cerrada de campos: lo demás se descarta, de modo que nunca
// se guardan contraseñas, hashes, tokens ni datos de tarjeta (Sprint 7, FR-024 a FR-026).
import * as modeloBitacora from '../models/auditModel.js';
import { AUDIT_ACTION as A } from '../utils/constants.js';

// entity: tipo de entidad; campos: campos permitidos del detalle.
const ACCIONES = {
  [A.LOGIN_FAILED]: { entity: 'user', campos: [] },
  [A.ACCOUNT_LOCKED]: { entity: 'user', campos: [] },
  [A.USER_CREATED]: { entity: 'user', campos: ['role'] },
  [A.USER_DEACTIVATED]: { entity: 'user', campos: [] },
  [A.USER_REACTIVATED]: { entity: 'user', campos: [] },
  [A.USER_ROLE_CHANGED]: { entity: 'user', campos: ['from', 'to'] },
  [A.SETTINGS_CHANGED]: { entity: 'settings', campos: ['changes'] },
  [A.PART_PRICE_CHANGED]: { entity: 'part', campos: ['field', 'from', 'to'] },
  [A.SERVICE_TYPE_CREATED]: { entity: 'service_type', campos: ['name'] },
  [A.SERVICE_TYPE_UPDATED]: { entity: 'service_type', campos: ['changes'] },
  [A.PAYMENT_CANCELLED]: { entity: 'payment', campos: ['orderId', 'amount'] },
  [A.TERMS_PUBLISHED]: { entity: 'terms', campos: ['version'] },
};

const soloPrimitivos = (v) => (v === null || ['string', 'number', 'boolean'].includes(typeof v) ? v : undefined);

function limpiarDetalle(accion, detalle = {}) {
  const permitidos = ACCIONES[accion].campos;
  const resultado = {};
  for (const campo of permitidos) {
    const valor = detalle?.[campo];
    if (valor === undefined) continue;
    if (campo === 'changes') {
      resultado.changes = (Array.isArray(valor) ? valor : []).map((c) => ({
        key: soloPrimitivos(c.key),
        from: soloPrimitivos(c.from) ?? null,
        to: soloPrimitivos(c.to) ?? null,
      }));
    } else if (soloPrimitivos(valor) !== undefined) {
      resultado[campo] = valor;
    }
  }
  return Object.keys(resultado).length > 0 ? resultado : null;
}

export function createAuditService({ auditModel = modeloBitacora } = {}) {
  async function record(accion, { userId = null, actorLabel = null, entityId = null, detail = null } = {}) {
    if (!ACCIONES[accion]) throw new Error(`Acción de bitácora desconocida: ${accion}`);
    await auditModel.insert(null, {
      userId,
      actorLabel: actorLabel === null ? null : String(actorLabel).slice(0, 120),
      action: accion,
      entity: ACCIONES[accion].entity,
      entityId,
      detail: limpiarDetalle(accion, detail ?? {}),
    });
  }

  const list = (filtros) => auditModel.list(filtros);

  return { record, list };
}

export const auditService = createAuditService();
