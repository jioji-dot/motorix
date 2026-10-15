// Piezas de validación compartidas por los esquemas zod, con mensajes en español.
import { z } from 'zod';
import { PASSWORD_POLICY_MESSAGE, isPasswordValid } from '../utils/password.js';

/** Texto obligatorio con recorte de espacios y longitud máxima. */
export function requiredString(etiqueta, { max = 255, min = 1 } = {}) {
  return z
    .string({
      required_error: `${etiqueta} es obligatorio.`,
      invalid_type_error: `${etiqueta} debe ser texto.`
    })
    .trim()
    .min(min, min === 1 ? `${etiqueta} es obligatorio.` : `${etiqueta} debe tener al menos ${min} caracteres.`)
    .max(max, `${etiqueta} admite como máximo ${max} caracteres.`);
}

/**
 * Texto opcional: vacío o null se convierte en null; si no viene, queda undefined
 * (así una edición parcial no borra el campo por omisión).
 */
export function optionalString(etiqueta, { max = 255 } = {}) {
  return z
    .string({ invalid_type_error: `${etiqueta} debe ser texto.` })
    .trim()
    .max(max, `${etiqueta} admite como máximo ${max} caracteres.`)
    .nullable()
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === '' ? null : valor));
}

/** Correo con formato válido, convertido a minúsculas. */
export function emailField(etiqueta = 'El correo electrónico', { max = 150 } = {}) {
  return requiredString(etiqueta, { max })
    .email(`${etiqueta} no tiene un formato válido.`)
    .transform((valor) => valor.toLowerCase());
}

/** Correo opcional: vacío o ausente se convierte en null; si viene, debe ser válido. */
export function optionalEmail(etiqueta = 'El correo electrónico', { max = 150 } = {}) {
  return z
    .string({ invalid_type_error: `${etiqueta} debe ser texto.` })
    .trim()
    .max(max, `${etiqueta} admite como máximo ${max} caracteres.`)
    .refine(
      (valor) => valor === '' || z.string().email().safeParse(valor).success,
      `${etiqueta} no tiene un formato válido.`
    )
    .nullable()
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor ? valor.toLowerCase() : null));
}

/** Contraseña nueva que cumple la política mínima. */
export function newPasswordField(etiqueta = 'La contraseña') {
  return z
    .string({
      required_error: `${etiqueta} es obligatoria.`,
      invalid_type_error: `${etiqueta} debe ser texto.`
    })
    .max(200, `${etiqueta} admite como máximo 200 caracteres.`)
    .refine(isPasswordValid, PASSWORD_POLICY_MESSAGE);
}

/** Identificador numérico de recurso recibido en la ruta. */
export const idParams = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'El identificador debe ser un número.' })
    .int('El identificador debe ser un número entero.')
    .positive('El identificador debe ser positivo.')
});

/** Parámetros comunes de listado. */
export const listQuery = {
  search: z
    .string()
    .trim()
    .max(100, 'La búsqueda admite como máximo 100 caracteres.')
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
};
