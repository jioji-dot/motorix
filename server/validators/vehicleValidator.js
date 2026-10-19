// Esquemas de validación de vehículos (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { listQuerySchema } from './commonValidator.js';

const MENSAJE_PROPIETARIO = 'El propietario es obligatorio.';

const propietario = z
  .number({ required_error: MENSAJE_PROPIETARIO, invalid_type_error: MENSAJE_PROPIETARIO })
  .int(MENSAJE_PROPIETARIO)
  .positive(MENSAJE_PROPIETARIO);

const texto = (etiqueta, maximo) =>
  z
    .string({ required_error: `${etiqueta} es obligatoria.`, invalid_type_error: `${etiqueta} no es válida.` })
    .trim()
    .min(1, `${etiqueta} es obligatoria.`)
    .max(maximo, `${etiqueta} no puede tener más de ${maximo} caracteres.`);

const marca = texto('La marca', 60);
const modelo = texto('El modelo', 60);

// Entre 1950 y el año actual más uno (los modelos del año siguiente ya circulan).
const anio = z
  .number({ required_error: 'El año es obligatorio.', invalid_type_error: 'El año no es válido.' })
  .int('El año no es válido.')
  .min(1950, 'El año debe ser 1950 o posterior.')
  .refine((valor) => valor <= new Date().getFullYear() + 1, {
    message: `El año no puede ser mayor a ${new Date().getFullYear() + 1}.`,
  });

// Se guardan en mayúsculas y sin espacios.
const placas = z
  .string({ required_error: 'Las placas son obligatorias.', invalid_type_error: 'Las placas no son válidas.' })
  .transform((valor) => valor.replace(/\s+/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .min(1, 'Las placas son obligatorias.')
      .max(15, 'Las placas no pueden tener más de 15 caracteres.')
      .regex(/^[A-Z0-9-]+$/, 'Las placas solo pueden tener letras, números y guiones.'),
  );

// Opcional; si se captura, 17 caracteres alfanuméricos.
const vin = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
  z
    .string({ invalid_type_error: 'El número de serie no es válido.' })
    .trim()
    .transform((valor) => valor.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{17}$/, 'El número de serie debe tener 17 caracteres alfanuméricos.'))
    .nullable()
    .optional(),
);

const kilometraje = z
  .number({ required_error: 'El kilometraje es obligatorio.', invalid_type_error: 'El kilometraje no es válido.' })
  .int('El kilometraje debe ser un número entero.')
  .min(0, 'El kilometraje no puede ser negativo.');

export const createVehicleSchema = z.object({
  clientId: propietario,
  brand: marca,
  model: modelo,
  year: anio,
  licensePlate: placas,
  vin,
  currentMileage: kilometraje,
});

// En este sprint el propietario no se cambia: `clientId` se ignora al editar.
export const updateVehicleSchema = z
  .object({
    brand: marca.optional(),
    model: modelo.optional(),
    year: anio.optional(),
    licensePlate: placas.optional(),
    vin,
    currentMileage: kilometraje.optional(),
    mileageCorrection: z.boolean({ invalid_type_error: 'La corrección debe ser verdadera o falsa.' }).optional(),
  })
  .refine(
    (datos) => Object.keys(datos).some((clave) => clave !== 'mileageCorrection' && datos[clave] !== undefined),
    { message: 'Envía al menos un campo para actualizar.' },
  );

export const vehicleListQuerySchema = listQuerySchema.extend({
  clientId: z.coerce.number().int().positive('El propietario no es válido.').optional(),
});
