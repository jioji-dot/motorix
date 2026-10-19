// Esquemas de validación de citas (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { fechaHoraLocalSchema, fechaSchema, listQuerySchema } from './commonValidator.js';
import { APPOINTMENT_STATUSES } from '../utils/constants.js';

const identificador = (mensaje) =>
  z.number({ required_error: mensaje, invalid_type_error: mensaje }).int(mensaje).positive(mensaje);

const motivo = z
  .string({ required_error: 'El motivo es obligatorio.', invalid_type_error: 'El motivo no es válido.' })
  .trim()
  .min(1, 'El motivo es obligatorio.')
  .max(255, 'El motivo no puede tener más de 255 caracteres.');

// Observaciones opcionales; un texto vacío se guarda como nulo.
const observaciones = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
  z
    .string({ invalid_type_error: 'Las observaciones no son válidas.' })
    .trim()
    .max(2000, 'Las observaciones no pueden tener más de 2000 caracteres.')
    .nullable()
    .optional(),
);

const confirmacion = z.boolean({ invalid_type_error: 'La confirmación debe ser verdadera o falsa.' }).optional();

export const createAppointmentSchema = z.object({
  clientId: identificador('El cliente es obligatorio.'),
  vehicleId: identificador('El vehículo es obligatorio.'),
  scheduledAt: fechaHoraLocalSchema,
  reason: motivo,
  notes: observaciones,
  confirmDuplicate: confirmacion,
});

export const updateAppointmentSchema = z
  .object({
    scheduledAt: fechaHoraLocalSchema.optional(),
    reason: motivo.optional(),
    notes: observaciones,
    confirmDuplicate: confirmacion,
  })
  .refine((datos) => Object.keys(datos).some((clave) => clave !== 'confirmDuplicate' && datos[clave] !== undefined), {
    message: 'Envía al menos un campo para actualizar.',
  });

export const appointmentListQuerySchema = listQuerySchema.extend({
  from: fechaSchema.optional(),
  to: fechaSchema.optional(),
  status: z
    .enum(APPOINTMENT_STATUSES, { errorMap: () => ({ message: 'El estado de la cita no es válido.' }) })
    .optional(),
  clientId: z.coerce.number().int().positive('El cliente no es válido.').optional(),
  vehicleId: z.coerce.number().int().positive('El vehículo no es válido.').optional(),
});
