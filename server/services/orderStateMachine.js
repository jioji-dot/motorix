// Máquina de estados de la orden de servicio. Es una función pura: no accede a la base de datos,
// lo que permite probar de forma exhaustiva todas las combinaciones (CA-8, SC-003).
import { ORDER_STATUS as S } from '../utils/constants.js';

// Quién aplica cada transición:
//  - TRABAJO: el mecánico asignado a la orden o un administrador.
//  - GESTION: recepción o un administrador.
const TRABAJO = 'TRABAJO';
const GESTION = 'GESTION';

const TRANSICIONES = Object.freeze({
  [S.RECEIVED]: { [S.DIAGNOSIS]: TRABAJO, [S.CANCELLED]: GESTION },
  [S.DIAGNOSIS]: { [S.IN_REPAIR]: TRABAJO, [S.CANCELLED]: GESTION },
  [S.IN_REPAIR]: { [S.WAITING_PARTS]: TRABAJO, [S.FINISHED]: TRABAJO, [S.CANCELLED]: GESTION },
  [S.WAITING_PARTS]: { [S.IN_REPAIR]: TRABAJO, [S.CANCELLED]: GESTION },
  [S.FINISHED]: { [S.DELIVERED]: GESTION },
  [S.DELIVERED]: {},
  [S.CANCELLED]: {},
});

/** ¿Existe la transición `de → a` para alguien, sin importar el rol? */
export function transitionExists(de, a) {
  return Boolean(TRANSICIONES[de]?.[a]);
}

function rolPermite(tipo, usuario, orden) {
  if (usuario.role === 'ADMIN') return true;
  if (tipo === TRABAJO) return usuario.role === 'MECHANIC' && usuario.id === orden.mechanicId;
  return usuario.role === 'RECEPTIONIST';
}

/** ¿Puede este usuario aplicar la transición `de → a` sobre esta orden? */
export function canTransition(de, a, usuario, orden) {
  const tipo = TRANSICIONES[de]?.[a];
  return tipo ? rolPermite(tipo, usuario, orden) : false;
}

/** Estados a los que este usuario puede pasar la orden ahora mismo. */
export function allowedTransitions(orden, usuario) {
  return Object.keys(TRANSICIONES[orden.status] ?? {}).filter((destino) =>
    canTransition(orden.status, destino, usuario, orden),
  );
}
