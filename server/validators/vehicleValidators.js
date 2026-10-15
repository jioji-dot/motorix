// Esquemas de validación de vehículos.
import { z } from 'zod';
import { normalizeLicensePlate, normalizeVin } from '../utils/normalizers.js';
import { listQuery, optionalString, requiredString } from './common.js';

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

const clientIdField = z
  .number({
    required_error: 'El propietario es obligatorio.',
    invalid_type_error: 'El propietario debe ser un identificador numérico.'
  })
  .int('El propietario debe ser un identificador numérico.')
  .positive('El propietario debe ser un identificador numérico.');

const yearField = z
  .number({
    required_error: 'El año es obligatorio.',
    invalid_type_error: 'El año debe ser un número.'
  })
  .int('El año debe ser un número entero.')
  .refine((anio) => anio >= 1950, 'El año no puede ser anterior a 1950.')
  .refine(
    (anio) => anio <= new Date().getFullYear() + 1,
    `El año no puede ser posterior a ${new Date().getFullYear() + 1}.`
  );

/** Placa normalizada: mayúsculas, sin espacios ni guiones, hasta 15 caracteres alfanuméricos. */
const licensePlateField = z
  .string({
    required_error: 'La placa es obligatoria.',
    invalid_type_error: 'La placa debe ser texto.'
  })
  .transform((valor) => normalizeLicensePlate(valor) ?? '')
  .pipe(
    z
      .string()
      .min(1, 'La placa es obligatoria.')
      .max(15, 'La placa admite como máximo 15 caracteres.')
      .regex(/^[A-Z0-9]+$/, 'La placa solo admite letras y números.')
  );

/** VIN opcional: 17 caracteres alfanuméricos sin I, O ni Q, en mayúsculas. */
const vinField = z
  .string({ invalid_type_error: 'El número de identificación debe ser texto.' })
  .nullable()
  .optional()
  .transform((valor) => (valor === undefined ? undefined : valor === null ? null : normalizeVin(valor)))
  .refine(
    (valor) => valor === undefined || valor === null || VIN_REGEX.test(valor),
    'El número de identificación debe tener 17 caracteres alfanuméricos, sin las letras I, O ni Q.'
  );

const mileageField = z
  .number({ invalid_type_error: 'El kilometraje debe ser un número.' })
  .int('El kilometraje debe ser un número entero.')
  .min(0, 'El kilometraje no puede ser negativo.');

const camposEditables = {
  brand: requiredString('La marca', { max: 60 }),
  model: requiredString('El modelo', { max: 60 }),
  year: yearField,
  licensePlate: licensePlateField,
  vin: vinField,
  color: optionalString('El color', { max: 30 }),
  currentMileage: mileageField
};

export const createVehicleBody = z.object({
  clientId: clientIdField,
  ...camposEditables,
  currentMileage: mileageField.optional()
});

export const updateVehicleBody = z
  .object({
    ...camposEditables,
    // El propietario no se puede cambiar (traspaso fuera del alcance del Sprint 1).
    clientId: z.any().refine((valor) => valor === undefined, 'El propietario no se puede cambiar.'),
    mileageCorrection: z.boolean({ invalid_type_error: 'La corrección debe ser verdadero o falso.' })
  })
  .partial()
  .refine(
    (datos) => datos.clientId !== undefined || Object.keys(camposEditables).some((c) => datos[c] !== undefined),
    'Debes indicar al menos un dato del vehículo para actualizar.'
  );

export const listVehiclesQuery = z.object({
  ...listQuery,
  clientId: z.coerce.number().int().positive().optional()
});
