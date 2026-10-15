// Emisión y verificación del JWT de sesión. El token solo contiene el id del usuario;
// el rol y el estado activo se leen de la base en cada petición.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/** @returns {{ sub: string }} carga del token; lanza un error si es inválido o expiró */
export function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

/** Vigencia en segundos del token emitido (para `expiresIn` en la respuesta de login). */
export function tokenTtlSeconds() {
  const { exp, iat } = jwt.decode(signToken(0));
  return exp - iat;
}
