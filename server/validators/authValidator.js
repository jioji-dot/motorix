// Esquemas de validación de autenticación (mensajes en español).
import { z } from 'zod';

// Política mínima: 8 caracteres, una mayúscula, una minúscula y un número.
export const passwordSchema = z
  .string({ required_error: 'La contraseña es obligatoria.', invalid_type_error: 'La contraseña no es válida.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una mayúscula.')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una minúscula.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.');

export const loginSchema = z.object({
  identifier: z
    .string({ required_error: 'Ingresa tu usuario o correo.', invalid_type_error: 'El usuario o correo no es válido.' })
    .trim()
    .min(1, 'Ingresa tu usuario o correo.'),
  password: z
    .string({ required_error: 'Ingresa tu contraseña.', invalid_type_error: 'La contraseña no es válida.' })
    .min(1, 'Ingresa tu contraseña.'),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: 'Ingresa tu contraseña actual.' })
    .min(1, 'Ingresa tu contraseña actual.'),
  newPassword: passwordSchema,
});
