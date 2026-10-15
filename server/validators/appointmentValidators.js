// Esquemas de validación de citas.
import { z } from 'zod';
import { APPOINTMENT_STATUS_VALUES, MAX_APPOINTMENT_DAYS_AHEAD } from '../config/constants.js';
import { dayRange, isFuture, isWithinDays, parseLocalDateTime } from '../utils/localDateTime.js';
import { listQuery, optionalString, requiredString } from './common.js';

const idField = (etiqueta) =>
  z
    .number({
      required_error: `${etiqueta} es obligatorio.`,
      invalid_type_error: `${etiqueta} debe ser un identificador numérico.`
    })
    .int(`${etiqueta} debe ser un identificador numérico.`)
    .positive(`${etiqueta} debe ser un identificador numérico.`);

/** Fecha y hora local `YYYY-MM-DDTHH:mm`: válida, futura y a no más de un año (FR-003). */
export const scheduledAtField = z
  .string({
    required_error: 'La fecha y la hora son obligatorias.',
    invalid_type_error: 'La fecha y la hora deben ser texto.'
  })
  .trim()
  .refine((valor) => parseLocalDateTime(valor) !== null, 'Usa el formato AAAA-MM-DDTHH:mm con una fecha real.')
  .refine((valor) => {
    const fecha = parseLocalDateTime(valor);
    return fecha === null || isFuture(fecha.date);
  }, 'La cita debe ser en una fecha y hora futuras.')
  .refine((valor) => {
    const fecha = parseLocalDateTime(valor);
    return fecha === null || isWithinDays(fecha.date, MAX_APPOINTMENT_DAYS_AHEAD);
  }, 'La cita no puede ser a más de un año de distancia.');

const reasonField = requiredString('El motivo', { max: 255 });
const notesField = optionalString('Las observaciones', { max: 500 });

export const createAppointmentBody = z.object({
  clientId: idField('El cliente'),
  vehicleId: idField('El vehículo'),
  scheduledAt: scheduledAtField,
  reason: reasonField,
  notes: notesField,
  confirmDuplicate: z.boolean({ invalid_type_error: 'La confirmación debe ser verdadero o falso.' }).optional()
});

export const updateAppointmentBody = z
  .object({
    scheduledAt: scheduledAtField,
    reason: reasonField,
    notes: notesField,
    confirmDuplicate: z.boolean({ invalid_type_error: 'La confirmación debe ser verdadero o falso.' }),
    // El cliente y el vehículo no se pueden cambiar: se cancela la cita y se registra otra.
    clientId: z.any().refine((valor) => valor === undefined, 'El cliente no se puede cambiar.'),
    vehicleId: z.any().refine((valor) => valor === undefined, 'El vehículo no se puede cambiar.')
  })
  .partial()
  .refine(
    (datos) => ['scheduledAt', 'reason', 'notes'].some((campo) => datos[campo] !== undefined),
    'Debes indicar al menos un dato de la cita para actualizar.'
  );

const dateFilter = (etiqueta) =>
  z
    .string()
    .refine((valor) => dayRange(valor) !== null, `${etiqueta} debe tener el formato AAAA-MM-DD.`)
    .optional();

export const listAppointmentsQuery = z.object({
  ...listQuery,
  date: dateFilter('La fecha'),
  from: dateFilter('La fecha inicial'),
  to: dateFilter('La fecha final'),
  status: z.enum(APPOINTMENT_STATUS_VALUES, { message: 'El estado no es válido.' }).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  vehicleId: z.coerce.number().int().positive().optional()
});
