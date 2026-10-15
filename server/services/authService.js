// Reglas de negocio de autenticación: acceso por usuario o correo, bloqueo temporal y contraseñas.
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS } from '../config/constants.js';
import * as userModel from '../models/userModel.js';
import { errors } from '../utils/AppError.js';
import { normalizeEmail, normalizeUsername } from '../utils/normalizers.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signToken, tokenTtlSeconds } from '../utils/token.js';

/** Datos del usuario que se devuelven en la sesión (nunca incluyen datos de contraseña). */
export function toSessionUser(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    name: usuario.name,
    email: usuario.email,
    role: usuario.role
  };
}

function segundosRestantes(hasta, ahora) {
  const segundos = Math.ceil((hasta.getTime() - ahora.getTime()) / 1000);
  // DATETIME guarda segundos enteros, por lo que el cálculo puede pasarse por un segundo.
  return Math.min(Math.max(1, segundos), LOGIN_LOCK_MINUTES * 60);
}

/**
 * Inicia sesión. Si el identificador contiene `@` se busca por correo; si no, por usuario.
 * No distingue mayúsculas ni espacios sobrantes.
 */
export async function login({ identifier, password }) {
  const texto = identifier.trim();
  const usuario = texto.includes('@')
    ? await userModel.findByEmail(normalizeEmail(texto))
    : await userModel.findByUsername(normalizeUsername(texto));

  // Mensaje genérico: no se revela si la cuenta existe o está inactiva.
  if (!usuario || !usuario.active) throw errors.invalidCredentials();

  const ahora = new Date();
  const bloqueoVigente = usuario.lockedUntil && usuario.lockedUntil.getTime() > ahora.getTime();
  if (bloqueoVigente) {
    throw errors.accountLocked(segundosRestantes(usuario.lockedUntil, ahora));
  }

  const coincide = await comparePassword(password, usuario.passwordHash);

  if (!coincide) {
    // Si el bloqueo anterior ya venció, el conteo empieza de nuevo.
    const base = usuario.lockedUntil ? 0 : usuario.failedLoginAttempts;
    const intentos = base + 1;

    if (intentos >= LOGIN_MAX_ATTEMPTS) {
      const hasta = new Date(ahora.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000);
      await userModel.updateLoginState(usuario.id, { failedLoginAttempts: 0, lockedUntil: hasta });
      throw errors.accountLocked(LOGIN_LOCK_MINUTES * 60);
    }

    await userModel.updateLoginState(usuario.id, {
      failedLoginAttempts: intentos,
      lockedUntil: null
    });
    throw errors.invalidCredentials();
  }

  if (usuario.failedLoginAttempts > 0 || usuario.lockedUntil) {
    await userModel.updateLoginState(usuario.id, { failedLoginAttempts: 0, lockedUntil: null });
  }

  return {
    token: signToken(usuario.id),
    expiresIn: tokenTtlSeconds(),
    user: toSessionUser(usuario)
  };
}

export function getProfile(usuario) {
  return toSessionUser(usuario);
}

/** Cambia la contraseña del usuario autenticado, exigiendo la contraseña actual. */
export async function changePassword(usuario, { currentPassword, newPassword }) {
  const coincide = await comparePassword(currentPassword, usuario.passwordHash);
  if (!coincide) throw errors.invalidCredentials();
  await userModel.updatePasswordHash(usuario.id, await hashPassword(newPassword));
}
