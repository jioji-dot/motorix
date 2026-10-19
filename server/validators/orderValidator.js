// Esquemas de validación de órdenes de servicio (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { MAX_MILEAGE } from '../utils/constants.js';

const identificador = (mensaje) =>
  z.number({ required_error: mensaje, invalid_type_error: mensaje }).int(mensaje).positive(mensaje);

const MENSAJE_KM = `El kilometraje de entrada debe ser un número entero entre 0 y ${MAX_MILEAGE.toLocaleString('en-US')} km.`;

const kilometrajeDeEntrada = z
  .number({ required_error: 'El kilometraje de entrada es obligatorio.', invalid_type_error: MENSAJE_KM })
  .int(MENSAJE_KM)
  .min(0, MENSAJE_KM)
  .max(MAX_MILEAGE, MENSAJE_KM);

const problemaReportado = z
  .string({ invalid_type_error: 'El problema reportado no es válido.' })
  .trim()
  .min(1, 'El problema reportado es obligatorio.')
  .max(2000, 'El problema reportado no puede tener más de 2000 caracteres.');

export const createOrderSchema = z
  .object({
    clientId: identificador('El cliente es obligatorio.'),
    vehicleId: identificador('El vehículo es obligatorio.'),
    mechanicId: identificador('El mecánico es obligatorio.'),
    entryMileage: kilometrajeDeEntrada,
    reportedProblem: problemaReportado.optional(),
    appointmentId: identificador('La cita no es válida.').optional(),
    mileageCorrection: z.boolean({ invalid_type_error: 'La corrección debe ser verdadera o falsa.' }).optional(),
  })
  .superRefine((datos, contexto) => {
    // Con una cita, el problema se toma de su motivo; sin ella, es obligatorio.
    if (datos.reportedProblem === undefined && datos.appointmentId === undefined) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reportedProblem'],
        message: 'El problema reportado es obligatorio.',
      });
    }
  });
