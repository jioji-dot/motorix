// Autenticación por JWT. El usuario se carga de la base en cada petición, de modo que un cambio
// de rol o una desactivación surten efecto de inmediato.
import * as userModel from '../models/userModel.js';
import { errors } from '../utils/AppError.js';
import { verifyToken } from '../utils/token.js';

/** Fábrica con dependencias inyectables (facilita las pruebas unitarias). */
export function createAuthenticate({
  findUserById = userModel.findById,
  verifyToken: verificar = verifyToken
} = {}) {
  return async function authenticate(req, res, next) {
    try {
      const cabecera = req.headers?.authorization ?? '';
      const [esquema, token] = cabecera.split(' ');
      if (esquema !== 'Bearer' || !token) throw errors.unauthenticated();

      let payload;
      try {
        payload = verificar(token);
      } catch {
        throw errors.unauthenticated('La sesión no es válida o expiró. Inicia sesión de nuevo.');
      }

      const usuario = await findUserById(Number(payload.sub));
      if (!usuario || !usuario.active) {
        throw errors.unauthenticated('La sesión no es válida o expiró. Inicia sesión de nuevo.');
      }

      req.user = usuario;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticate();
