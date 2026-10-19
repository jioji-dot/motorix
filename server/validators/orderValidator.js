// Esquemas de validación de órdenes de servicio (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { MAX_MILEAGE, ORDER_STATUSES } from '../utils/constants.js';
import { fechaSchema, importeSchema, listQuerySchema } from './commonValidator.js';

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

export const orderListQuerySchema = listQuerySchema.extend({
  status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: 'El estado de la orden no es válido.' }) }).optional(),
  mechanicId: z.coerce.number().int().positive('El mecánico no es válido.').optional(),
  from: fechaSchema.optional(),
  to: fechaSchema.optional(),
});

// Textos largos de la orden; un texto vacío se guarda como nulo.
const textoLargo = (etiqueta) =>
  z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
    z
      .string({ invalid_type_error: `${etiqueta} no es válido.` })
      .trim()
      .max(4000, `${etiqueta} no puede tener más de 4000 caracteres.`)
      .nullable()
      .optional(),
  );

const MENSAJE_KM_SERVICIO = `El kilometraje del servicio debe ser un número entero entre el kilometraje de entrada y ${MAX_MILEAGE.toLocaleString('en-US')} km.`;

const kilometrajeDelServicio = z
  .number({ invalid_type_error: MENSAJE_KM_SERVICIO })
  .int(MENSAJE_KM_SERVICIO)
  .min(0, MENSAJE_KM_SERVICIO)
  .max(MAX_MILEAGE, MENSAJE_KM_SERVICIO);

const alMenosUnCampo = (datos) => Object.values(datos).some((valor) => valor !== undefined);
const MENSAJE_SIN_CAMPOS = { message: 'Envía al menos un campo para actualizar.' };

export const updateOrderSchema = z
  .object({
    diagnosis: textoLargo('El diagnóstico'),
    notes: textoLargo('Las observaciones'),
    recommendations: textoLargo('Las recomendaciones'),
    reportedProblem: problemaReportado.optional(),
    mechanicId: identificador('El mecánico no es válido.').optional(),
    serviceMileage: kilometrajeDelServicio.optional(),
  })
  .refine(alMenosUnCampo, MENSAJE_SIN_CAMPOS);

const descripcionDeLinea = z
  .string({ required_error: 'La descripción es obligatoria.', invalid_type_error: 'La descripción no es válida.' })
  .trim()
  .min(1, 'La descripción es obligatoria.')
  .max(255, 'La descripción no puede tener más de 255 caracteres.');

const importe = importeSchema('El importe');
const horas = importeSchema('El número de horas', { minimo: 0.01, maximo: 999.99 });
const tarifa = importeSchema('El valor de la tarifa por hora');

export const serviceLineSchema = z.object({ description: descripcionDeLinea, amount: importe });

export const updateServiceLineSchema = z
  .object({ description: descripcionDeLinea.optional(), amount: importe.optional() })
  .refine(alMenosUnCampo, MENSAJE_SIN_CAMPOS);

export const laborSchema = z.object({ description: descripcionDeLinea, hours: horas, hourlyRate: tarifa });

export const updateLaborSchema = z
  .object({ description: descripcionDeLinea.optional(), hours: horas.optional(), hourlyRate: tarifa.optional() })
  .refine(alMenosUnCampo, MENSAJE_SIN_CAMPOS);

export const lineParamsSchema = z.object({
  id: z.coerce.number().int().positive('El identificador no es válido.'),
  lineId: z.coerce.number().int().positive('El identificador de la línea no es válido.'),
});

// Cambio de estado. Al cancelar el motivo es obligatorio; `expectedStatus` permite detectar cambios simultáneos.
export const changeStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, {
      errorMap: () => ({ message: 'El estado de la orden no es válido.' }),
    }),
    reason: z.preprocess(
      (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
      z
        .string({ invalid_type_error: 'El motivo no es válido.' })
        .trim()
        .max(255, 'El motivo no puede tener más de 255 caracteres.')
        .optional(),
    ),
    expectedStatus: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: 'El estado esperado no es válido.' }) }).optional(),
  })
  .superRefine((datos, contexto) => {
    if (datos.status === 'CANCELADA' && datos.reason === undefined) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Indica el motivo de la cancelación.' });
    }
  });
