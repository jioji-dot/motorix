// Manejo centralizado de errores: respuesta JSON uniforme y sin detalles internos.
import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'La ruta solicitada no existe.'));
}

// Express exige los cuatro parámetros para reconocer un manejador de errores.
export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    const cuerpo = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) cuerpo.error.details = error.details;
    Object.assign(cuerpo.error, error.extra);
    return res.status(error.status).json(cuerpo);
  }

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'El cuerpo de la petición no es un JSON válido.' },
    });
  }

  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: { code: 'DUPLICATE_VALUE', message: 'Ya existe un registro con esos datos.' },
    });
  }

  // Error inesperado: se registra en el servidor, pero el usuario solo ve un mensaje genérico.
  if (process.env.NODE_ENV !== 'test') console.error('Error interno:', error);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.' },
  });
}
