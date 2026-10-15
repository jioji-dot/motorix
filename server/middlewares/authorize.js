// Autorización por rol. Se usa después de `authenticate`: authorize('ADMIN', 'RECEPTIONIST').
import { errors } from '../utils/AppError.js';

export function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    if (!rolesPermitidos.includes(req.user.role)) return next(errors.forbidden());
    return next();
  };
}
