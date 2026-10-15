// Respuesta para rutas inexistentes.
import { errors } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(errors.notFound('La ruta solicitada no existe.'));
}
