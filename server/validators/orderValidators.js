// Esquemas de validación de órdenes de servicio.
import { z } from 'zod';
import { ORDER_STATUS_VALUES } from '../config/constants.js';
import { listQuery, optionalString, requiredString } from './common.js';

const idField = (etiqueta) =>
  z
    .number({ invalid_type_error: `${etiqueta} debe ser un identificador numérico.` })
    .int(`${etiqueta} debe ser un identificador numérico.`)
    .positive(`${etiqueta} debe ser un identificador numérico.`);

const entryMileageField = z
  .number({
    required_error: 'El kilometraje de entrada es obligatorio.',
    invalid_type_error: 'El kilometraje de entrada debe ser un número.'
  })
  .int('El kilometraje de entrada debe ser un número entero.')
  .min(0, 'El kilometraje de entrada no puede ser negativo.');

const reportedProblemField = requiredString('El problema reportado', { max: 1000 });

const mileageCorrectionField = z.boolean({
  invalid_type_error: 'La corrección debe ser verdadero o falso.'
});

/**
 * Alta de orden. Con `appointmentId`, el cliente, el vehículo y el motivo se toman de la cita;
 * sin ella, cliente, vehículo y problema reportado son obligatorios.
 */
export const createOrderBody = z
  .object({
    appointmentId: idField('La cita').optional(),
    clientId: idField('El cliente').optional(),
    vehicleId: idField('El vehículo').optional(),
    mechanicId: idField('El mecánico').nullable().optional(),
    entryMileage: entryMileageField,
    reportedProblem: reportedProblemField.optional(),
    mileageCorrection: mileageCorrectionField.optional()
  })
  .superRefine((datos, ctx) => {
    if (datos.appointmentId !== undefined) return;
    const obligatorios = [
      ['clientId', 'El cliente es obligatorio.'],
      ['vehicleId', 'El vehículo es obligatorio.'],
      ['reportedProblem', 'El problema reportado es obligatorio.']
    ];
    for (const [campo, mensaje] of obligatorios) {
      if (datos[campo] === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: mensaje });
      }
    }
  });

/**
 * Corrección de datos básicos por recepción o administración (FR-013a): problema reportado,
 * mecánico asignado y kilometraje de entrada. Al menos uno debe venir.
 */
export const updateOrderBasicsBody = z
  .object({
    reportedProblem: reportedProblemField,
    mechanicId: idField('El mecánico').nullable(),
    entryMileage: entryMileageField,
    mileageCorrection: mileageCorrectionField
  })
  .partial()
  .refine(
    (datos) => ['reportedProblem', 'mechanicId', 'entryMileage'].some((c) => datos[c] !== undefined),
    'Debes indicar al menos un dato de la orden para corregir.'
  );

/** Kilometraje con el que termina el servicio (opcional): entero no negativo; `null` lo borra. */
const serviceMileageField = z
  .number({ invalid_type_error: 'El kilometraje de servicio debe ser un número.' })
  .int('El kilometraje de servicio debe ser un número entero.')
  .min(0, 'El kilometraje de servicio no puede ser negativo.')
  .max(4294967295, 'El kilometraje de servicio es demasiado grande.')
  .nullable();

/**
 * Diagnóstico, observaciones y recomendaciones (hasta 5000 caracteres; vacío = null) y kilometraje
 * de servicio.
 */
export const updateWorkBody = z
  .object({
    diagnosis: optionalString('El diagnóstico', { max: 5000 }),
    notes: optionalString('Las observaciones', { max: 5000 }),
    recommendations: optionalString('Las recomendaciones', { max: 5000 }),
    serviceMileage: serviceMileageField.optional()
  })
  .refine(
    (datos) =>
      ['diagnosis', 'notes', 'recommendations', 'serviceMileage'].some((c) => datos[c] !== undefined),
    'Debes indicar al menos el diagnóstico, las observaciones, las recomendaciones o el kilometraje de servicio.'
  );

/** Número con máximo dos decimales (importes, tarifas y horas). */
const dosDecimales = (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;

const moneyField = (etiqueta, maximo) =>
  z
    .number({
      required_error: `${etiqueta} es obligatorio.`,
      invalid_type_error: `${etiqueta} debe ser un número.`
    })
    .min(0, `${etiqueta} no puede ser negativo.`)
    .max(maximo, `${etiqueta} no puede ser mayor a ${maximo}.`)
    .refine(dosDecimales, `${etiqueta} admite como máximo dos decimales.`);

const hoursField = z
  .number({
    required_error: 'Las horas son obligatorias.',
    invalid_type_error: 'Las horas deben ser un número.'
  })
  .gt(0, 'Las horas deben ser mayores a 0.')
  .max(9999.99, 'Las horas no pueden ser mayores a 9999.99.')
  .refine(dosDecimales, 'Las horas admiten como máximo dos decimales.');

const lineDescription = requiredString('La descripción', { max: 255 });

export const serviceBody = z.object({
  description: lineDescription,
  amount: moneyField('El importe', 99999999.99)
});

export const updateServiceBody = serviceBody
  .partial()
  .refine((datos) => datos.description !== undefined || datos.amount !== undefined, 'Indica qué dato del servicio cambiar.');

export const laborBody = z.object({
  description: lineDescription,
  hours: hoursField,
  hourlyRate: moneyField('La tarifa por hora', 99999.99)
});

export const updateLaborBody = laborBody
  .partial()
  .refine(
    (datos) => ['description', 'hours', 'hourlyRate'].some((c) => datos[c] !== undefined),
    'Indica qué dato de la mano de obra cambiar.'
  );

export const serviceParams = z.object({
  id: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive()
});

export const laborParams = z.object({
  id: z.coerce.number().int().positive(),
  laborId: z.coerce.number().int().positive()
});

export const changeStatusBody = z.object({
  status: z.enum(ORDER_STATUS_VALUES, {
    required_error: 'El estado es obligatorio.',
    invalid_type_error: 'El estado no es válido.',
    message: `El estado debe ser uno de: ${ORDER_STATUS_VALUES.join(', ')}.`
  })
});

export const listOrdersQuery = z.object({
  ...listQuery,
  status: z.enum(ORDER_STATUS_VALUES, { message: 'El estado no es válido.' }).optional(),
  mechanicId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  paymentStatus: z
    .enum(['UNPAID', 'PARTIAL', 'PAID', 'DUE'], {
      errorMap: () => ({ message: 'El estado de pago debe ser UNPAID, PARTIAL, PAID o DUE.' })
    })
    .optional()
});

const quantityField = z
  .number({
    required_error: 'La cantidad es obligatoria.',
    invalid_type_error: 'La cantidad debe ser un número.'
  })
  .int('La cantidad debe ser un número entero.')
  .min(1, 'La cantidad debe ser al menos 1.')
  .max(100000, 'La cantidad no puede ser mayor a 100000.');

/** Refacción usada en la orden: identificador de la refacción y cantidad entera positiva. */
export const addOrderPartBody = z.object({
  partId: idField('La refacción'),
  quantity: quantityField
});

export const updateOrderPartBody = z.object({ quantity: quantityField });

export const orderPartParams = z.object({
  id: z.coerce.number().int().positive(),
  orderPartId: z.coerce.number().int().positive()
});
