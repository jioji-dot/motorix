// Esquemas de validación de refacciones y movimientos de inventario (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { MAX_STOCK, MOVEMENT_TYPES, STOCK_LEVELS } from '../utils/constants.js';
import { importeSchema } from './commonValidator.js';

const texto = (etiqueta, maximo) =>
  z
    .string({ required_error: `${etiqueta} es obligatorio.`, invalid_type_error: `${etiqueta} no es válido.` })
    .trim()
    .min(1, `${etiqueta} es obligatorio.`)
    .max(maximo, `${etiqueta} no puede tener más de ${maximo} caracteres.`);

const existencia = (etiqueta) => {
  const mensaje = `${etiqueta} debe ser un número entero entre 0 y ${MAX_STOCK.toLocaleString('en-US')}.`;
  return z.number({ invalid_type_error: mensaje, required_error: `${etiqueta} es obligatorio.` }).int(mensaje).min(0, mensaje).max(MAX_STOCK, mensaje);
};

const code = texto('El código', 40);
const name = texto('El nombre', 120);
const category = texto('La categoría', 60);
const brand = texto('La marca', 60);
const minimumStock = existencia('El stock mínimo');
const purchasePrice = importeSchema('El precio de compra');
const salePrice = importeSchema('El precio de venta');

export const createPartSchema = z.object({
  code,
  name,
  category,
  brand,
  minimumStock,
  purchasePrice,
  salePrice,
  initialStock: existencia('La existencia inicial').optional(),
});

// El código y el stock no se editan: cualquier valor enviado se descarta.
export const updatePartSchema = z
  .object({
    name: name.optional(),
    category: category.optional(),
    brand: brand.optional(),
    minimumStock: minimumStock.optional(),
    purchasePrice: purchasePrice.optional(),
    salePrice: salePrice.optional(),
    active: z.boolean({ invalid_type_error: 'El campo "active" debe ser verdadero o falso.' }).optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Envía al menos un campo para actualizar.',
  });

const MENSAJE_CANTIDAD = `La cantidad debe ser un número entero entre 1 y ${MAX_STOCK.toLocaleString('en-US')}.`;

export const movementSchema = z
  .object({
    type: z.enum(MOVEMENT_TYPES, { errorMap: () => ({ message: 'El tipo de movimiento no es válido.' }) }),
    quantity: z
      .number({ required_error: 'La cantidad es obligatoria.', invalid_type_error: MENSAJE_CANTIDAD })
      .int(MENSAJE_CANTIDAD),
    reason: texto('El motivo', 255),
  })
  .superRefine((datos, contexto) => {
    const agregar = (message) => contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message });
    if (datos.type === 'ADJUSTMENT') {
      if (datos.quantity === 0) agregar('El ajuste debe ser una diferencia distinta de cero (positiva o negativa).');
      else if (Math.abs(datos.quantity) > MAX_STOCK) agregar('El ajuste no puede ser mayor a 1,000,000 piezas.');
    } else if (datos.quantity < 1 || datos.quantity > MAX_STOCK) {
      agregar(MENSAJE_CANTIDAD);
    }
  });

export const partListQuerySchema = z.object({
  search: z.string().trim().max(120, 'La búsqueda es demasiado larga.').optional(),
  category: z.string().trim().max(60, 'La categoría es demasiado larga.').optional(),
  stockLevel: z
    .string()
    .transform((valor) => valor.split(',').map((parte) => parte.trim().toUpperCase()).filter(Boolean))
    .pipe(
      z
        .array(z.enum(STOCK_LEVELS.filter((nivel) => nivel !== 'OK'), { errorMap: () => ({ message: 'El nivel de stock no es válido.' }) }))
        .min(1, 'El nivel de stock no es válido.'),
    )
    .optional(),
  active: z
    .enum(['true', 'false', 'all'], { errorMap: () => ({ message: 'El filtro "active" debe ser true, false o all.' }) })
    .optional(),
  page: z.coerce.number().int().min(1, 'La página debe ser 1 o mayor.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño de página debe ser 1 o mayor.')
    .max(100, 'El tamaño de página no puede ser mayor a 100.')
    .default(20),
});

// Alta y cambio de cantidad de una refacción en una orden: solo `partId` y `quantity`; un precio enviado se descarta.
const cantidadEnOrden = z
  .number({ required_error: 'La cantidad es obligatoria.', invalid_type_error: MENSAJE_CANTIDAD })
  .int(MENSAJE_CANTIDAD)
  .min(1, MENSAJE_CANTIDAD)
  .max(MAX_STOCK, MENSAJE_CANTIDAD);

export const orderPartSchema = z.object({
  partId: z
    .number({ required_error: 'La refacción es obligatoria.', invalid_type_error: 'La refacción no es válida.' })
    .int('La refacción no es válida.')
    .positive('La refacción no es válida.'),
  quantity: cantidadEnOrden,
});

export const updateOrderPartSchema = z.object({ quantity: cantidadEnOrden });
