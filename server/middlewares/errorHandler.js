// Manejo centralizado de errores: respuestas consistentes y sin trazas internas.
import { ZodError } from 'zod';
import { AppError, errors } from '../utils/AppError.js';

// Traduce el nombre del índice único violado al error de duplicado correspondiente.
function traducirDuplicado(error) {
  const detalle = `${error.sqlMessage || ''}`;
  // MySQL 8 informa el índice como 'tabla.columna' (por ejemplo: for key 'users.username').
  if (/users\.username/i.test(detalle)) return errors.duplicateUsername();
  if (/users\.email/i.test(detalle)) return errors.duplicateEmail();
  if (/vehicles\.license_plate/i.test(detalle)) return errors.duplicateLicensePlate();
  if (/vehicles\.vin/i.test(detalle)) return errors.duplicateVin();
  if (/parts\.(uq_parts_code|code)/i.test(detalle)) return errors.partCodeDuplicate();
  if (/maintenance\.uq_maintenance_pending/i.test(detalle)) return errors.maintenancePendingExists(null);
  // Respaldo de la base: un segundo cobro pendiente de Mercado Pago en la misma orden.
  if (/payments\.uq_payments_pending_mp/i.test(detalle)) return errors.paymentPendingExists(null);
  return null;
}

function traducirZod(error) {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || undefined,
    message: issue.message
  }));
  return errors.validation('Los datos enviados no son válidos.', details);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  let appError = error;

  if (error instanceof ZodError) {
    appError = traducirZod(error);
  } else if (error?.code === 'ER_DUP_ENTRY') {
    appError = traducirDuplicado(error) ?? errors.internal();
  } else if (error?.type === 'entity.parse.failed') {
    appError = errors.validation('El cuerpo de la petición no es un JSON válido.');
  } else if (error?.type === 'entity.too.large') {
    appError = errors.validation('El cuerpo de la petición es demasiado grande.');
  } else if (!(error instanceof AppError)) {
    // Error inesperado: se registra en el servidor, pero nunca se expone al usuario.
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error inesperado:', error);
    }
    appError = errors.internal();
  }

  const cuerpo = { error: { code: appError.code, message: appError.message } };
  if (appError.details !== undefined) cuerpo.error.details = appError.details;
  res.status(appError.status).json(cuerpo);
}
