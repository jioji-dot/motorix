// Filtros de la consulta de la bitácora (mensajes en español). Sprint 7, FR-025.
import { z } from 'zod';
import { AUDIT_ACTIONS } from '../utils/constants.js';
import { fechaSchema } from './commonValidator.js';

export const auditListQuerySchema = z.object({
  from: fechaSchema.optional(),
  to: fechaSchema.optional(),
  userId: z.coerce.number({ invalid_type_error: 'El usuario no es válido.' }).int('El usuario no es válido.').positive('El usuario no es válido.').optional(),
  action: z.enum(AUDIT_ACTIONS, { errorMap: () => ({ message: 'La acción no es válida.' }) }).optional(),
  page: z.coerce.number().int().min(1, 'La página debe ser 1 o mayor.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño de página debe ser 1 o mayor.')
    .max(100, 'El tamaño de página no puede ser mayor a 100.')
    .default(50),
});
