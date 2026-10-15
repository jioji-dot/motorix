// Esquemas de validación de pagos.
import { z } from 'zod';
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_VALUES, PAYMENT_STATUS_VALUES } from '../config/constants.js';
import { hasAtMostTwoDecimals, toCents } from '../utils/money.js';
import { isValidDay } from '../utils/localDateTime.js';
import { listQuery, requiredString } from './common.js';

/** Importe en pesos: mayor a cero, hasta 99999999.99 y con máximo dos decimales. */
const amountField = (etiqueta = 'El importe') =>
  z
    .number({
      required_error: `${etiqueta} es obligatorio.`,
      invalid_type_error: `${etiqueta} debe ser un número.`
    })
    .gt(0, `${etiqueta} debe ser mayor a cero.`)
    .max(99999999.99, `${etiqueta} no puede ser mayor a 99999999.99.`)
    .refine(hasAtMostTwoDecimals, `${etiqueta} admite como máximo dos decimales.`);

/**
 * Registro de un pago manual: efectivo, tarjeta o transferencia (nace aprobado).
 * - `reference`: opcional, solo tarjeta y transferencia (autorización u operación, máximo 100).
 * - `receivedAmount`: opcional, solo efectivo y no menor al importe; sirve para calcular el cambio.
 * Es estricto: cualquier otro campo (por ejemplo datos de tarjeta) se rechaza y nunca se guarda.
 */
export const registerPaymentBody = z
  .object({
    method: z.enum(MANUAL_PAYMENT_METHODS, {
      errorMap: () => ({ message: 'El método debe ser efectivo, tarjeta o transferencia.' })
    }),
    amount: amountField(),
    reference: z
      .string({ invalid_type_error: 'La referencia debe ser texto.' })
      .trim()
      .min(1, 'La referencia no puede estar vacía.')
      .max(100, 'La referencia no puede superar 100 caracteres.')
      .optional(),
    receivedAmount: amountField('El importe recibido').optional()
  })
  .strict('Solo se permiten el método, el importe, la referencia y el importe recibido.')
  .superRefine((datos, ctx) => {
    if (datos.reference !== undefined && datos.method === 'CASH') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: 'La referencia solo aplica a pagos con tarjeta o transferencia.'
      });
    }
    if (datos.receivedAmount !== undefined) {
      if (datos.method !== 'CASH') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['receivedAmount'],
          message: 'El importe recibido solo aplica a pagos en efectivo.'
        });
      } else if (toCents(datos.receivedAmount) < toCents(datos.amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['receivedAmount'],
          message: 'El importe recibido no puede ser menor al importe del pago.'
        });
      }
    }
  });

/** Cobro de Mercado Pago: el importe es opcional (por omisión, el saldo disponible). */
export const mercadoPagoBody = z
  .object({ amount: amountField().optional() })
  .strict('Solo se permite indicar el importe.');

/** Anulación de un pago aprobado: el motivo es obligatorio. */
export const voidPaymentBody = z
  .object({ reason: requiredString('El motivo', { max: 255 }) })
  .strict('Solo se permite indicar el motivo.');

const dayField = (etiqueta) =>
  z
    .string()
    .trim()
    .refine(isValidDay, `${etiqueta} debe tener el formato AAAA-MM-DD y ser un día real.`)
    .optional();

export const listPaymentsQuery = z.object({
  ...listQuery,
  status: z
    .enum(PAYMENT_STATUS_VALUES, { errorMap: () => ({ message: 'El estado del pago no es válido.' }) })
    .optional(),
  method: z
    .enum(PAYMENT_METHOD_VALUES, { errorMap: () => ({ message: 'El método de pago no es válido.' }) })
    .optional(),
  from: dayField('La fecha inicial'),
  to: dayField('La fecha final')
});
