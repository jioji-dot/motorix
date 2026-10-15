// Esquemas de validación de la autenticación.
import { z } from 'zod';
import { newPasswordField, requiredString } from './common.js';

export const loginBody = z.object({
  identifier: requiredString('El usuario o correo electrónico', { max: 150 }),
  password: z
    .string({
      required_error: 'La contraseña es obligatoria.',
      invalid_type_error: 'La contraseña debe ser texto.'
    })
    .min(1, 'La contraseña es obligatoria.')
    .max(200, 'La contraseña admite como máximo 200 caracteres.')
});

export const changePasswordBody = z
  .object({
    currentPassword: z
      .string({ required_error: 'La contraseña actual es obligatoria.' })
      .min(1, 'La contraseña actual es obligatoria.')
      .max(200),
    newPassword: newPasswordField('La contraseña nueva')
  })
  .refine((datos) => datos.currentPassword !== datos.newPassword, {
    path: ['newPassword'],
    message: 'La contraseña nueva debe ser distinta de la actual.'
  });
