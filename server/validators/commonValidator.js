// Esquemas reutilizables: identificadores de ruta y paginación de listados.
import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'El identificador no es válido.' })
    .int('El identificador no es válido.')
    .positive('El identificador no es válido.'),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(120, 'La búsqueda es demasiado larga.').optional(),
  active: z
    .enum(['true', 'false'], { errorMap: () => ({ message: 'El filtro "active" debe ser true o false.' }) })
    .transform((valor) => valor === 'true')
    .optional(),
  page: z.coerce.number().int().min(1, 'La página debe ser 1 o mayor.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño de página debe ser 1 o mayor.')
    .max(100, 'El tamaño de página no puede ser mayor a 100.')
    .default(20),
});

// Escapa los comodines de LIKE para que la búsqueda sea literal.
export function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

// ---------------------------------------------------------------------------
// Esquemas reutilizables del Sprint 2 (importes, fechas y fechas-hora locales).
// ---------------------------------------------------------------------------

const MAXIMO_IMPORTE = 99999999.99;

// Importe con dos decimales como máximo: acepta número o cadena y lo devuelve como número redondeado.
export function importeSchema(etiqueta = 'El importe', { minimo = 0, maximo = MAXIMO_IMPORTE } = {}) {
  return z
    .union([z.number(), z.string().trim().min(1, `${etiqueta} es obligatorio.`)], {
      errorMap: () => ({ message: `${etiqueta} es obligatorio.` }),
    })
    .transform((valor) => (typeof valor === 'string' ? Number(valor) : valor))
    .pipe(
      z
        .number({ invalid_type_error: `${etiqueta} no es válido.` })
        .finite(`${etiqueta} no es válido.`)
        .min(minimo, `${etiqueta} no puede ser menor a ${minimo}.`)
        .max(maximo, `${etiqueta} no puede ser mayor a ${maximo.toLocaleString('en-US')}.`)
        .refine((valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6, {
          message: `${etiqueta} puede tener hasta dos decimales.`,
        }),
    )
    .transform((valor) => Math.round(valor * 100) / 100);
}

// Fecha 'YYYY-MM-DD' (filtros de rango).
export const fechaSchema = z
  .string({ invalid_type_error: 'La fecha no es válida.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD.')
  .refine((valor) => !Number.isNaN(new Date(`${valor}T00:00:00`).getTime()), { message: 'La fecha no es válida.' });

// Fecha y hora local 'YYYY-MM-DDTHH:mm' → objeto Date (hora local del taller).
export const fechaHoraLocalSchema = z
  .string({ required_error: 'La fecha y hora son obligatorias.', invalid_type_error: 'La fecha y hora no son válidas.' })
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'La fecha y hora deben tener el formato AAAA-MM-DDTHH:mm.')
  .transform((valor) => new Date(`${valor}:00`))
  .refine((fecha) => !Number.isNaN(fecha.getTime()), { message: 'La fecha y hora no son válidas.' });

// Formato 'YYYY-MM-DD HH:mm:ss' en hora local, para guardar en columnas DATETIME sin conversiones de zona.
export function aDatetimeLocal(fecha) {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

// Paginación sencilla para consultas sin filtros (historial, movimientos).
export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'La página debe ser 1 o mayor.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño de página debe ser 1 o mayor.')
    .max(100, 'El tamaño de página no puede ser mayor a 100.')
    .default(20),
});
