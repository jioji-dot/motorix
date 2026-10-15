// Esquemas de validación de la gestión de usuarios.
import { z } from 'zod';
import { ROLE_VALUES } from '../config/constants.js';
import { emailField, listQuery, newPasswordField, requiredString } from './common.js';

const usernameField = requiredString('El usuario', { max: 50 })
  .min(3, 'El usuario debe tener al menos 3 caracteres.')
  .regex(
    /^[A-Za-z0-9._-]+$/,
    'El usuario solo admite letras, números, punto, guion y guion bajo.'
  );

const roleField = z.enum(ROLE_VALUES, {
  required_error: 'El rol es obligatorio.',
  invalid_type_error: 'El rol no es válido.',
  message: 'El rol debe ser ADMIN, RECEPTIONIST o MECHANIC.'
});

export const createUserBody = z.object({
  username: usernameField,
  name: requiredString('El nombre', { max: 100 }),
  email: emailField('El correo electrónico'),
  role: roleField,
  password: newPasswordField('La contraseña')
});

export const updateUserBody = z
  .object({
    name: requiredString('El nombre', { max: 100 }),
    email: emailField('El correo electrónico'),
    role: roleField,
    active: z.boolean({ invalid_type_error: 'El estado debe ser verdadero o falso.' }),
    // El nombre de usuario no se modifica después del alta.
    username: z.any().refine((valor) => valor === undefined, 'El usuario no se puede modificar.')
  })
  .partial()
  .refine(
    (datos) => ['name', 'email', 'role', 'active'].some((campo) => datos[campo] !== undefined),
    'Debes indicar al menos un dato del usuario para actualizar.'
  );

export const resetPasswordBody = z.object({
  newPassword: newPasswordField('La contraseña nueva')
});

export const listUsersQuery = z.object({
  ...listQuery,
  role: z.enum(ROLE_VALUES, { message: 'El rol no es válido.' }).optional(),
  active: z
    .enum(['true', 'false'], { message: 'El estado debe ser true o false.' })
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === 'true'))
});
