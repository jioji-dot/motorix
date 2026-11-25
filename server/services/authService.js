// Lógica de autenticación: inicio de sesión, bloqueo por intentos fallidos y cambio de contraseña.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as modeloUsuarios from '../models/userModel.js';
import { AUDIT_ACTION } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { auditService as bitacora } from './auditService.js';

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

// Hash de relleno para que comparar un usuario inexistente tarde lo mismo que uno real.
const HASH_RELLENO = bcrypt.hashSync('relleno-no-valido', 4);

export function datosPublicos(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    name: usuario.name,
    email: usuario.email,
    role: usuario.role,
  };
}

export function createAuthService({
  userModel = modeloUsuarios,
  now = () => new Date(),
  jwtSecret = env.jwt.secret,
  jwtExpiresIn = env.jwt.expiresIn,
  bcryptCost = 10,
  auditService = bitacora,
} = {}) {
  // El registro de la bitácora nunca debe impedir responder al inicio de sesión.
  const registrar = (accion, datos) => auditService.record(accion, datos).catch(() => {});

  async function buscarUsuario(identificador) {
    const valor = identificador.trim().toLowerCase();
    // Si contiene "@" se busca por correo; si no, por nombre de usuario.
    return valor.includes('@') ? userModel.findAuthByEmail(valor) : userModel.findAuthByUsername(valor);
  }

  async function login(identificador, contrasena) {
    const usuario = await buscarUsuario(identificador);

    if (!usuario) {
      await bcrypt.compare(contrasena, HASH_RELLENO);
      await registrar(AUDIT_ACTION.LOGIN_FAILED, { actorLabel: identificador.trim() });
      throw HttpError.invalidCredentials();
    }

    const ahora = now();
    if (usuario.lockedUntil && new Date(usuario.lockedUntil) > ahora) {
      const restante = Math.ceil((new Date(usuario.lockedUntil) - ahora) / 1000);
      const segundos = Math.min(restante, MINUTOS_BLOQUEO * 60); // DATETIME redondea al segundo
      throw HttpError.locked(segundos);
    }

    const coincide = await bcrypt.compare(contrasena, usuario.passwordHash);
    if (!coincide) {
      await registrar(AUDIT_ACTION.LOGIN_FAILED, { userId: usuario.id, actorLabel: identificador.trim(), entityId: usuario.id });
      if ((usuario.failedAttempts ?? 0) + 1 >= MAX_INTENTOS) {
        await userModel.lockAccount(usuario.id, new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60 * 1000));
        await registrar(AUDIT_ACTION.ACCOUNT_LOCKED, { userId: usuario.id, actorLabel: identificador.trim(), entityId: usuario.id });
      } else {
        await userModel.registerFailedAttempt(usuario.id);
      }
      throw HttpError.invalidCredentials();
    }

    // La cuenta desactivada solo se revela cuando la contraseña es correcta.
    if (!usuario.active) throw HttpError.accountDisabled();

    if (usuario.failedAttempts > 0 || usuario.lockedUntil) await userModel.resetAttempts(usuario.id);

    await userModel.markActivity?.(usuario.id); // la sesión nueva empieza con actividad reciente
    const token = jwt.sign({ sub: usuario.id }, jwtSecret, { expiresIn: jwtExpiresIn });
    const { exp, iat } = jwt.decode(token);
    return { token, expiresIn: exp - iat, user: datosPublicos(usuario) };
  }

  async function changePassword(userId, contrasenaActual, contrasenaNueva) {
    const usuario = await userModel.findAuthById(userId);
    if (!usuario) throw HttpError.unauthenticated();

    const coincide = await bcrypt.compare(contrasenaActual, usuario.passwordHash);
    if (!coincide) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'La contraseña actual es incorrecta.');
    }

    const hash = await bcrypt.hash(contrasenaNueva, bcryptCost);
    await userModel.updatePasswordHash(userId, hash);
  }

  return { login, changePassword };
}

export const authService = createAuthService();
