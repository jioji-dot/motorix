// Autorización por rol. Se aplica siempre después de authenticate.
import { HttpError } from '../utils/httpError.js';

export function authorize(...rolesPermitidos) {
  return (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthenticated());
    if (!rolesPermitidos.includes(req.user.role)) return next(HttpError.forbidden());
    return next();
  };
}
