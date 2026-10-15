// Reglas de negocio de la gestión de usuarios (solo ADMIN).
import * as userModel from '../models/userModel.js';
import { errors } from '../utils/AppError.js';
import { normalizePagination } from '../utils/normalizers.js';
import { hashPassword } from '../utils/password.js';
import { ROLES } from '../config/constants.js';

/** Usuario tal como lo expone la API: nunca incluye datos de contraseña ni de bloqueo. */
export function toUserDto(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    name: usuario.name,
    email: usuario.email,
    role: usuario.role,
    active: usuario.active,
    createdAt: usuario.createdAt,
    updatedAt: usuario.updatedAt
  };
}

async function getOrFail(id) {
  const usuario = await userModel.findById(id);
  if (!usuario) throw errors.notFound('El usuario no existe.');
  return usuario;
}

export async function createUser({ username, name, email, role, password }) {
  const id = await userModel.insert({
    username,
    name,
    email,
    role,
    passwordHash: await hashPassword(password)
  });
  return toUserDto(await userModel.findById(id));
}

export async function listUsers({ search, role, active, page, pageSize }) {
  const paginacion = normalizePagination({ page, pageSize });
  const { rows, total } = await userModel.list({
    search: search || undefined,
    role,
    active,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return { items: rows.map(toUserDto), total, page: paginacion.page, pageSize: paginacion.pageSize };
}

export async function getUserById(id) {
  return toUserDto(await getOrFail(id));
}

/**
 * Edita un usuario. Protege el sistema contra quedarse sin administración:
 * - un administrador no puede desactivarse ni cambiar su propio rol;
 * - no se puede desactivar ni degradar a la última cuenta de administrador activa.
 */
export async function updateUser(actor, id, datos) {
  const objetivo = await getOrFail(id);

  const desactiva = datos.active === false && objetivo.active;
  const cambiaRol = datos.role !== undefined && datos.role !== objetivo.role;

  if (actor.id === objetivo.id && (desactiva || cambiaRol)) {
    throw errors.lastAdminProtected(
      'No puedes desactivar tu propia cuenta ni cambiar tu propio rol.'
    );
  }

  const dejaDeSerAdminActivo =
    objetivo.role === ROLES.ADMIN &&
    objetivo.active &&
    (desactiva || (cambiaRol && datos.role !== ROLES.ADMIN));
  if (dejaDeSerAdminActivo && (await userModel.countActiveAdmins()) <= 1) {
    throw errors.lastAdminProtected();
  }

  await userModel.update(id, {
    name: datos.name,
    email: datos.email,
    role: datos.role,
    active: datos.active
  });
  return toUserDto(await userModel.findById(id));
}

/** Restablece la contraseña de otro usuario y limpia cualquier bloqueo por intentos fallidos. */
export async function resetPassword(id, newPassword) {
  await getOrFail(id);
  await userModel.updatePasswordHash(id, await hashPassword(newPassword));
  await userModel.updateLoginState(id, { failedLoginAttempts: 0, lockedUntil: null });
}
