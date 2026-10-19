// Lógica de negocio de usuarios (gestión por el administrador).
import bcrypt from 'bcryptjs';
import { withTransaction } from '../config/db.js';
import * as modeloUsuarios from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';

const MENSAJE_USUARIO = 'Ya existe un usuario con ese nombre de usuario.';
const MENSAJE_CORREO = 'Ya existe un usuario con ese correo.';

function duplicado(campo, mensaje) {
  return HttpError.duplicate(mensaje, [{ field: campo, message: mensaje }]);
}

// Traduce un choque de la restricción UNIQUE (carrera entre dos altas) al mismo error de negocio.
function traducirDuplicadoDeBase(error) {
  if (error?.code !== 'ER_DUP_ENTRY') return error;
  return String(error.sqlMessage).includes('uq_users_email')
    ? duplicado('email', MENSAJE_CORREO)
    : duplicado('username', MENSAJE_USUARIO);
}

export function createUserService({
  userModel = modeloUsuarios,
  transaction = withTransaction,
  bcryptCost = 10,
} = {}) {
  async function list(filtros) {
    const { items, total } = await userModel.list(filtros);
    return { items, meta: { page: filtros.page, pageSize: filtros.pageSize, total } };
  }

  async function get(id) {
    const usuario = await userModel.findPublicById(id);
    if (!usuario) throw HttpError.notFound('No se encontró el usuario solicitado.');
    return usuario;
  }

  async function create({ password, ...datos }) {
    if (await userModel.findAuthByUsername(datos.username)) throw duplicado('username', MENSAJE_USUARIO);
    if (await userModel.findAuthByEmail(datos.email)) throw duplicado('email', MENSAJE_CORREO);

    const passwordHash = await bcrypt.hash(password, bcryptCost);
    try {
      return await userModel.create({ ...datos, passwordHash });
    } catch (error) {
      throw traducirDuplicadoDeBase(error);
    }
  }

  async function update(id, { password, ...datos }) {
    const actual = await userModel.findById(id);
    if (!actual) throw HttpError.notFound('No se encontró el usuario solicitado.');

    if (datos.email !== undefined) {
      const otro = await userModel.findAuthByEmail(datos.email);
      if (otro && otro.id !== id) throw duplicado('email', MENSAJE_CORREO);
    }

    const nuevoHash = password ? await bcrypt.hash(password, bcryptCost) : null;

    // La verificación del último administrador y el cambio van en una transacción (FR-013).
    try {
      return await transaction(async (conexion) => {
        const dejaDeSerAdminActivo =
          actual.role === 'ADMIN' &&
          Boolean(actual.active) &&
          (datos.active === false || (datos.role !== undefined && datos.role !== 'ADMIN'));

        if (dejaDeSerAdminActivo && (await userModel.countActiveAdmins(conexion)) <= 1) {
          throw new HttpError(
            409,
            'LAST_ADMIN',
            'No puedes desactivar ni quitar el rol al único administrador activo. Crea o activa otro administrador primero.',
          );
        }

        if (nuevoHash) {
          await userModel.updatePasswordHash(id, nuevoHash, conexion);
          await userModel.resetAttempts(id, conexion); // restablecer la contraseña también desbloquea la cuenta
        }
        return userModel.update(id, datos, conexion);
      });
    } catch (error) {
      throw traducirDuplicadoDeBase(error);
    }
  }

  return { list, get, create, update };
}

export const userService = createUserService();
