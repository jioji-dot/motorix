// Esquemas de validación de mantenimientos programados.
import { z } from 'zod';
import { isValidDay } from '../utils/localDateTime.js';
import { MAINTENANCE_STATUS_VALUES } from '../config/constants.js';
import { listQuery, requiredString } from './common.js';

const nextDateField = z
  .string({ invalid_type_error: 'La fecha debe ser texto con el formato AAAA-MM-DD.' })
  .trim()
  .refine(isValidDay, 'La fecha no es válida: usa el formato AAAA-MM-DD y un día real.');

const nextMileageField = z
  .number({ invalid_type_error: 'El kilometraje debe ser un número.' })
  .int('El kilometraje debe ser un número entero.')
  .min(0, 'El kilometraje no puede ser negativo.')
  .max(4294967295, 'El kilometraje es demasiado grande.');

const descriptionField = requiredString('La descripción', { max: 255 });

const FALTA_OBJETIVO = 'Indica la fecha, el kilometraje o ambos del próximo mantenimiento.';

/** Alta: la orden de origen, la descripción y al menos una referencia (fecha o kilometraje). */
export const createMaintenanceBody = z
  .object({
    orderId: z
      .number({
        required_error: 'La orden es obligatoria.',
        invalid_type_error: 'La orden debe ser un identificador numérico.'
      })
      .int('La orden debe ser un identificador numérico.')
      .positive('La orden debe ser un identificador numérico.'),
    description: descriptionField,
    nextDate: nextDateField.nullable().optional(),
    nextMileage: nextMileageField.nullable().optional(),
    replacePending: z.boolean({ invalid_type_error: 'La confirmación debe ser verdadero o falso.' }).optional()
  })
  .superRefine((datos, ctx) => {
    if (datos.nextDate == null && datos.nextMileage == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nextDate'], message: FALTA_OBJETIVO });
    }
  });

/** Edición parcial; `null` quita la fecha o el kilometraje (debe quedar al menos uno). */
export const updateMaintenanceBody = z
  .object({
    description: descriptionField,
    nextDate: nextDateField.nullable(),
    nextMileage: nextMileageField.nullable()
  })
  .partial()
  .refine(
    (datos) => Object.values(datos).some((valor) => valor !== undefined),
    'Debes indicar al menos un dato del mantenimiento para cambiar.'
  );

/**
 * Listado para avisar a los clientes: `classification` (OVERDUE, UPCOMING o ALERT = ambos, por
 * omisión) o `status` (que ignora la clasificación), búsqueda por cliente o placa y paginación.
 */
export const listMaintenanceQuery = z.object({
  classification: z
    .enum(['OVERDUE', 'UPCOMING', 'ALERT'], {
      errorMap: () => ({ message: 'La clasificación debe ser OVERDUE, UPCOMING o ALERT.' })
    })
    .optional(),
  status: z
    .enum(MAINTENANCE_STATUS_VALUES, {
      errorMap: () => ({ message: 'El estado debe ser PENDIENTE, REALIZADO o CANCELADO.' })
    })
    .optional(),
  ...listQuery
});
