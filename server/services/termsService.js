// Términos y condiciones y aviso de privacidad por versión, con aceptación por usuario (Sprint 7, FR-018 a FR-022).
import * as modeloTerminos from '../models/termsModel.js';
import { AUDIT_ACTION, TERMS_TEXT_MAX } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { auditService as bitacora } from './auditService.js';

const publica = (v, accepted) => ({
  version: v.version,
  termsText: v.termsText,
  privacyText: v.privacyText,
  publishedAt: v.publishedAt,
  accepted,
});

export function createTermsService({ termsModel = modeloTerminos, auditService = bitacora } = {}) {
  // Versión vigente con el estado de aceptación del usuario, o nulo si no hay ninguna publicada.
  async function getCurrent(usuario) {
    const v = await termsModel.current();
    if (!v) return null;
    return publica(v, await termsModel.hasAccepted(usuario.id, v.version));
  }

  async function accept(usuario) {
    const v = await termsModel.current();
    if (!v) throw HttpError.notFound('Todavía no hay términos y condiciones publicados.');
    await termsModel.accept(usuario.id, v.version);
    return { version: v.version, acceptedAt: new Date().toISOString() };
  }

  async function publish({ termsText, privacyText }, usuario) {
    const problemas = [];
    const limpio = { termsText: String(termsText ?? '').trim(), privacyText: String(privacyText ?? '').trim() };
    for (const [campo, etiqueta] of [['termsText', 'El texto de los términos'], ['privacyText', 'El aviso de privacidad']]) {
      if (limpio[campo] === '') problemas.push({ field: campo, message: `${etiqueta} es obligatorio.` });
      else if (limpio[campo].length > TERMS_TEXT_MAX) problemas.push({ field: campo, message: `${etiqueta} es demasiado largo.` });
    }
    if (problemas.length > 0) throw HttpError.validation('Revisa los datos enviados.', problemas);

    const version = await termsModel.publish({ ...limpio, userId: usuario.id });
    // Quien publica acepta su propia versión para no quedar bloqueado fuera del sistema.
    await termsModel.accept(usuario.id, version);
    await auditService.record(AUDIT_ACTION.TERMS_PUBLISHED, { userId: usuario.id, entityId: version, detail: { version } });
    return { version, ...limpio, publishedAt: new Date().toISOString(), accepted: true };
  }

  async function acceptances() {
    const v = await termsModel.current();
    if (!v) return { version: null, accepted: [], pending: [] };
    return { version: v.version, ...(await termsModel.acceptances(v.version)) };
  }

  return { getCurrent, accept, publish, acceptances };
}

export const termsService = createTermsService();
