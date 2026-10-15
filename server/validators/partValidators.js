// Esquemas de validación de refacciones e inventario.
import { z } from 'zod';
import { listQuery, optionalString, requiredString } from './common.js';

const codeField = requiredString('El código', { max: 40 }).transform((valor) => valor.toUpperCase());

const nameField = requiredString('El nombre', { max: 150 });

/** Número con máximo dos decimales. */
const dosDecimales = (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;

const priceField = z
  .number({
    required_error: 'El precio es obligatorio.',
    invalid_type_error: 'El precio debe ser un número.'
  })
  .min(0, 'El precio no puede ser negativo.')
  .max(99999999.99, 'El precio no puede ser mayor a 99999999.99.')
  .refine(dosDecimales, 'El precio admite como máximo dos decimales.');

/** Entero mayor o igual a `minimo` con mensajes en español. */
const integerField = (etiqueta, { min = 0, max = 2147483647 } = {}) =>
  z
    .number({
      required_error: `${etiqueta} es obligatorio.`,
      invalid_type_error: `${etiqueta} debe ser un número.`
    })
    .int(`${etiqueta} debe ser un número entero.`)
    .min(min, min === 0 ? `${etiqueta} no puede ser negativo.` : `${etiqueta} debe ser al menos ${min}.`)
    .max(max, `${etiqueta} no puede ser mayor a ${max}.`);

export const createPartBody = z.object({
  code: codeField,
  name: nameField,
  description: optionalString('La descripción', { max: 500 }),
  price: priceField,
  minimumStock: integerField('El stock mínimo').optional(),
  initialStock: integerField('La existencia inicial').optional()
});

/** Edición parcial. La existencia NO se edita aquí: cambia solo con movimientos. */
export const updatePartBody = z
  .object({
    code: codeField,
    name: nameField,
    description: optionalString('La descripción', { max: 500 }),
    price: priceField,
    minimumStock: integerField('El stock mínimo')
  })
  .partial()
  .strict('Solo se pueden editar el código, el nombre, la descripción, el precio y el stock mínimo.')
  .refine(
    (datos) => Object.values(datos).some((valor) => valor !== undefined),
    'Debes indicar al menos un dato de la refacción para cambiar.'
  );

/** Filtro de activas: acepta "true" o "false" en la consulta. */
const activeQuery = z
  .enum(['true', 'false'], { invalid_type_error: 'El filtro de activas debe ser true o false.' })
  .optional()
  .transform((valor) => (valor === undefined ? undefined : valor === 'true'));

export const listPartsQuery = z.object({
  ...listQuery,
  active: activeQuery,
  alert: z
    .enum(['LOW', 'OUT', 'ANY'], {
      errorMap: () => ({ message: 'El filtro de alerta debe ser LOW, OUT o ANY.' })
    })
    .optional()
});

const reasonField = requiredString('El motivo', { max: 255 });

/** Entrada de mercancía: cantidad entera mayor o igual a 1 y motivo obligatorio. */
export const entryBody = z.object({
  quantity: integerField('La cantidad', { min: 1 }),
  reason: reasonField
});

/** Ajuste por conteo físico: indica la existencia contada (no la diferencia) y el motivo. */
export const adjustmentBody = z.object({
  newStock: integerField('La existencia contada'),
  reason: reasonField
});

export const movementsQuery = z.object({
  page: listQuery.page,
  pageSize: listQuery.pageSize
});

/** Búsqueda de refacciones disponibles para una orden: texto de al menos 2 caracteres. */
export const availablePartsQuery = z.object({
  search: z
    .string({
      required_error: 'El texto de búsqueda es obligatorio.',
      invalid_type_error: 'El texto de búsqueda debe ser texto.'
    })
    .trim()
    .min(2, 'Escribe al menos 2 caracteres para buscar.')
    .max(100, 'La búsqueda admite como máximo 100 caracteres.'),
  limit: z.coerce
    .number({ invalid_type_error: 'El límite debe ser un número.' })
    .int('El límite debe ser un número entero.')
    .min(1, 'El límite debe ser al menos 1.')
    .max(50, 'El límite no puede ser mayor a 50.')
    .optional()
});
