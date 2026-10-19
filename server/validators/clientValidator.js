// Esquemas de validación de clientes (mensajes en español).
import { z } from 'zod';

const nombre = z
  .string({ required_error: 'El nombre es obligatorio.', invalid_type_error: 'El nombre no es válido.' })
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(120, 'El nombre no puede tener más de 120 caracteres.');

// Se aceptan espacios, guiones y paréntesis; se guarda solo con los 10 dígitos.
const telefono = z
  .string({ required_error: 'El teléfono es obligatorio.', invalid_type_error: 'El teléfono no es válido.' })
  .transform((valor) => valor.replace(/[\s\-().]/g, ''))
  .pipe(z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos.'));

const correo = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
  z
    .string({ invalid_type_error: 'El correo no es válido.' })
    .trim()
    .max(120, 'El correo no puede tener más de 120 caracteres.')
    .email('El correo no tiene un formato válido.')
    .nullable()
    .optional(),
);

const confirmacionTelefono = z.boolean({ invalid_type_error: 'La confirmación debe ser verdadera o falsa.' }).optional();

export const createClientSchema = z.object({
  name: nombre,
  phone: telefono,
  email: correo,
  confirmDuplicatePhone: confirmacionTelefono,
});

export const updateClientSchema = z
  .object({
    name: nombre.optional(),
    phone: telefono.optional(),
    email: correo,
    active: z.boolean({ invalid_type_error: 'El estado debe ser verdadero o falso.' }).optional(),
    confirmDuplicatePhone: confirmacionTelefono,
  })
  .refine(
    (datos) => Object.keys(datos).some((clave) => clave !== 'confirmDuplicatePhone' && datos[clave] !== undefined),
    { message: 'Envía al menos un campo para actualizar.' },
  );
