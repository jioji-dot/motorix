// Autenticación con JWT. El rol y el estado activo se consultan en cada petición (FR-009),
// por lo que un cambio de rol o una desactivación surten efecto de inmediato.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as userModel from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';

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
