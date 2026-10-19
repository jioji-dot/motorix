// Esquemas de validación de usuarios (mensajes en español). Reglas según data-model.md.
import { z } from 'zod';
import { listQuerySchema } from './commonValidator.js';
import { passwordSchema } from './authValidator.js';

const ROLES = ['ADMIN', 'RECEPTIONIST', 'MECHANIC'];

// 3 a 50 caracteres, sin espacios.
const nombreDeUsuario = z
  .string({ required_error: 'El nombre de usuario es obligatorio.', invalid_type_error: 'El nombre de usuario no es válido.' })
  .trim()
  .min(3, 'El nombre de usuario debe tener al menos 3 caracteres.')
  .max(50, 'El nombre de usuario no puede tener más de 50 caracteres.')
  .regex(/^\S+$/, 'El nombre de usuario no puede tener espacios.');

const nombre = z
  .string({ required_error: 'El nombre es obligatorio.', invalid_type_error: 'El nombre no es válido.' })
  .trim()
  .min(1, 'El nombre es obligatorio.')
  .max(120, 'El nombre no puede tener más de 120 caracteres.');

const correo = z
  .string({ required_error: 'El correo es obligatorio.', invalid_type_error: 'El correo no es válido.' })
  .trim()
  .max(120, 'El correo no puede tener más de 120 caracteres.')
  .email('El correo no tiene un formato válido.')
  .transform((valor) => valor.toLowerCase());

const rol = z.enum(ROLES, {
  errorMap: () => ({ message: 'El rol debe ser ADMIN, RECEPTIONIST o MECHANIC.' }),
});

export const createUserSchema = z.object({
  username: nombreDeUsuario,
  name: nombre,
  email: correo,
  role: rol,
  password: passwordSchema,
});

// El nombre de usuario no se cambia: `username` se ignora al editar.
export const updateUserSchema = z
  .object({
    name: nombre.optional(),
    email: correo.optional(),
    role: rol.optional(),
    active: z.boolean({ invalid_type_error: 'El estado debe ser verdadero o falso.' }).optional(),
    password: passwordSchema.optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Envía al menos un campo para actualizar.',
  });

export const userListQuerySchema = listQuerySchema.extend({
  role: rol.optional(),
});
