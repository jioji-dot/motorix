// Esquemas de validación de los tipos de servicio (mensajes en español). Sprint 7, FR-005.
import { z } from 'zod';
import { SERVICE_TYPE_LIMITS as L } from '../utils/constants.js';

const nombre = z
  .string({ required_error: 'El nombre es obligatorio.', invalid_type_error: 'El nombre no es válido.' })
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(L.NAME_MAX, `El nombre no puede tener más de ${L.NAME_MAX} caracteres.`);

const intervalo = (etiqueta, { min, max }, unidad) =>
  z
    .number({ invalid_type_error: `${etiqueta} debe ser un número entero.` })
    .int(`${etiqueta} debe ser un número entero.`)
    .min(min, `${etiqueta} debe ser de ${min} a ${max.toLocaleString('en-US')} ${unidad}.`)
    .max(max, `${etiqueta} debe ser de ${min} a ${max.toLocaleString('en-US')} ${unidad}.`)
    .nullable();

const dias = intervalo('El intervalo en días', L.DAYS, 'días');
const km = intervalo('El intervalo en kilómetros', L.KM, 'km');
const MENSAJE_INTERVALO = 'Indica el intervalo en días, en kilómetros o en ambos.';

export const createServiceTypeSchema = z
  .object({ name: nombre, intervalDays: dias.optional(), intervalKm: km.optional() })
  .refine((d) => (d.intervalDays ?? null) !== null || (d.intervalKm ?? null) !== null, { message: MENSAJE_INTERVALO, path: ['intervalDays'] });

export const updateServiceTypeSchema = z
  .object({ name: nombre.optional(), intervalDays: dias.optional(), intervalKm: km.optional(), active: z.boolean({ invalid_type_error: 'El estado no es válido.' }).optional() })
  .refine((d) => Object.keys(d).length > 0, { message: 'Indica al menos un dato para actualizar.' });
