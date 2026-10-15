// Política de contraseñas y cifrado con bcrypt.
import bcrypt from 'bcryptjs';

export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.';

/** Verifica la política mínima: 8 caracteres, mayúscula, minúscula y número. */
export function isPasswordValid(contrasena) {
  if (typeof contrasena !== 'string') return false;
  return (
    contrasena.length >= 8 &&
    /[A-Z]/.test(contrasena) &&
    /[a-z]/.test(contrasena) &&
    /[0-9]/.test(contrasena)
  );
}

const SALT_ROUNDS = 10;

export function hashPassword(contrasena) {
  return bcrypt.hash(contrasena, SALT_ROUNDS);
}

export function comparePassword(contrasena, hash) {
  return bcrypt.compare(contrasena, hash);
}
