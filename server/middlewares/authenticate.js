// Autenticación con JWT. El rol y el estado activo se consultan en cada petición (FR-009),
// por lo que un cambio de rol o una desactivación surten efecto de inmediato.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as termsModel from '../models/termsModel.js';
import * as userModel from '../models/userModel.js';
import { ACTIVITY_REFRESH_SECONDS, SESSION_INACTIVITY_MINUTES } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

// Rutas que un usuario sin aceptación vigente de los términos sí puede usar: consultar su sesión, ver los términos y aceptarlos.
const EXENTAS_DE_TERMINOS = new Set(['/api/auth/me', '/api/terms/current', '/api/terms/accept']);

// La consulta automática de avisos (cada 60 segundos) no cuenta como actividad: no debe mantener viva una sesión abandonada.
const esConsultaAutomatica = (req) => req.method === 'GET' && (req.originalUrl ?? '').split('?')[0] === '/api/notifications';

export async function authenticate(req, _res, next) {
  try {
    const cabecera = req.headers.authorization ?? '';
    const [esquema, token] = cabecera.split(' ');
    if (esquema !== 'Bearer' || !token) throw HttpError.unauthenticated();

    let carga;
    try {
      carga = jwt.verify(token, env.jwt.secret);
    } catch {
      throw HttpError.unauthenticated('Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
    }

    const usuario = await userModel.findById(carga.sub);
    if (!usuario) throw HttpError.unauthenticated('Tu sesión ya no es válida. Inicia sesión de nuevo.');
    if (!usuario.active) throw HttpError.accountDisabled();

    // Cierre por inactividad validado en el servidor (Sprint 7, FR-028). Una marca nula se trata como vigente.
    const segundos = await userModel.secondsSinceActivity(usuario.id);
    if (segundos !== null && segundos > SESSION_INACTIVITY_MINUTES * 60) throw HttpError.sessionInactive();
    if (!esConsultaAutomatica(req) && (segundos === null || segundos > ACTIVITY_REFRESH_SECONDS)) {
      await userModel.markActivity(usuario.id);
    }

    // Aceptación de los términos vigentes: se valida en el servidor en todas las rutas protegidas (Sprint 7, FR-021).
    const ruta = (req.originalUrl ?? '').split('?')[0].replace(/\/+$/, '');
    if (!EXENTAS_DE_TERMINOS.has(ruta)) {
      const vigente = await termsModel.current();
      if (vigente && !(await termsModel.hasAccepted(usuario.id, vigente.version))) throw HttpError.termsNotAccepted();
    }

    req.user = {
      id: usuario.id,
      username: usuario.username,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}
