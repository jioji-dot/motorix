// Esquemas de validación de mantenimientos (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { MAINTENANCE_CLASSES, MAX_MILEAGE } from '../utils/constants.js';
import { fechaSchema } from './commonValidator.js';

const identificador = (mensaje) =>
  z.number({ required_error: mensaje, invalid_type_error: mensaje }).int(mensaje).positive(mensaje);

const kilometraje = (etiqueta) => {
  const mensaje = `${etiqueta} debe ser un número entero entre 0 y ${MAX_MILEAGE.toLocaleString('en-US')} km.`;
  return z.number({ invalid_type_error: mensaje, required_error: `${etiqueta} es obligatorio.` }).int(mensaje).min(0, mensaje).max(MAX_MILEAGE, mensaje);
};

const tipoDeServicio = z
  .string({ required_error: 'El tipo de servicio es obligatorio.', invalid_type_error: 'El tipo de servicio no es válido.' })
  .trim()
  .min(1, 'El tipo de servicio es obligatorio.')
  .max(100, 'El tipo de servicio no puede tener más de 100 caracteres.');

const notas = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
  z
    .string({ invalid_type_error: 'Las notas no son válidas.' })
    .trim()
    .max(2000, 'Las notas no pueden tener más de 2000 caracteres.')
    .nullable()
    .optional(),
);

// Reglas cruzadas compartidas por el alta y la edición (la edición las vuelve a aplicar con los valores ya guardados).
export function reglasDeMantenimiento({ lastServiceDate, lastMileage, nextDate, nextMileage }) {
  const problemas = [];
  const sinFecha = nextDate === undefined || nextDate === null;
  const sinKm = nextMileage === undefined || nextMileage === null;
  if (sinFecha && sinKm) {
    problemas.push({ field: 'nextDate', message: 'Indica la próxima fecha, el próximo kilometraje o ambos.' });
  }
  if (!sinFecha && lastServiceDate && nextDate < lastServiceDate) {
    problemas.push({ field: 'nextDate', message: 'La próxima fecha no puede ser anterior a la del último servicio.' });
  }
  if (!sinKm && lastMileage !== undefined && nextMileage <= lastMileage) {
    problemas.push({ field: 'nextMileage', message: 'El próximo kilometraje debe ser mayor al del último servicio.' });
  }
  return problemas;
}

export const createMaintenanceSchema = z
  .object({
    vehicleId: identificador('El vehículo es obligatorio.'),
    serviceType: tipoDeServicio,
    lastServiceDate: fechaSchema,
    lastMileage: kilometraje('El kilometraje del último servicio'),
    nextDate: fechaSchema.nullable().optional(),
    nextMileage: kilometraje('El próximo kilometraje').nullable().optional(),
    notes: notas,
    sourceOrderId: identificador('La orden de origen no es válida.').optional(),
  })
  .superRefine((datos, contexto) => {
    for (const problema of reglasDeMantenimiento(datos)) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: [problema.field], message: problema.message });
    }
  });

export const updateMaintenanceSchema = z
  .object({
    serviceType: tipoDeServicio.optional(),
    lastServiceDate: fechaSchema.optional(),
    lastMileage: kilometraje('El kilometraje del último servicio').optional(),
    nextDate: fechaSchema.nullable().optional(),
    nextMileage: kilometraje('El próximo kilometraje').nullable().optional(),
    notes: notas,
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Envía al menos un campo para actualizar.',
  });

const listaDeClases = z
  .string()
  .transform((texto) => texto.split(',').map((parte) => parte.trim().toUpperCase()).filter(Boolean))
  .pipe(
    z
      .array(z.enum(MAINTENANCE_CLASSES), { errorMap: () => ({ message: 'La clasificación no es válida.' }) })
      .min(1, 'La clasificación no es válida.'),
  );

export const maintenanceListQuerySchema = z.object({
  classification: listaDeClases.optional(),
  status: z
    .enum(['PENDIENTE', 'ATENDIDO', 'all'], { errorMap: () => ({ message: 'El estado del mantenimiento no es válido.' }) })
    .default('PENDIENTE'),
  vehicleId: z.coerce.number().int().positive('El vehículo no es válido.').optional(),
  clientId: z.coerce.number().int().positive('El cliente no es válido.').optional(),
  search: z.string().trim().max(120, 'La búsqueda es demasiado larga.').optional(),
  page: z.coerce.number().int().min(1, 'La página debe ser 1 o mayor.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño de página debe ser 1 o mayor.')
    .max(100, 'El tamaño de página no puede ser mayor a 100.')
    .default(20),
});
