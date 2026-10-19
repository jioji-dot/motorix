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
