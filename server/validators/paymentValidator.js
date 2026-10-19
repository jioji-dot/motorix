// Esquemas de validación de pagos (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { PAYMENT_METHODS } from '../utils/constants.js';
import { importeSchema } from './commonValidator.js';

// Una referencia con forma de número de tarjeta (13 a 19 dígitos, con o sin espacios o guiones) se rechaza (RN-14).
const PARECE_TARJETA = /(?:\d[ -]?){13,19}/;

const referencia = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
  z
    .string({ invalid_type_error: 'La referencia no es válida.' })
    .trim()
    .max(100, 'La referencia no puede tener más de 100 caracteres.')
    .refine((texto) => !PARECE_TARJETA.test(texto), {
      message: 'La referencia no puede contener un número de tarjeta. Captura solo el número de autorización o de transferencia.',
    })
    .optional(),
);

export const createPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: 'El método de pago debe ser Efectivo, Tarjeta, Transferencia o Mercado Pago.' }),
  }),
  amount: importeSchema('El importe', { minimo: 0.01 }),
  reference: referencia,
});

// Identificador de ticket de impresión en la dirección.
export const printTokenParamSchema = z.object({
  token: z.string().min(10, 'El enlace de impresión no es válido.').max(2000, 'El enlace de impresión no es válido.'),
});
