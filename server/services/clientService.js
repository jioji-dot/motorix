// Reglas de negocio de clientes.
import * as clientModel from '../models/clientModel.js';
import * as vehicleModel from '../models/vehicleModel.js';
import { errors } from '../utils/AppError.js';
import { normalizePagination } from '../utils/normalizers.js';

const soloDigitos = (telefono) => telefono.replace(/\D/g, '');

/**
 * Advierte con 409 si el teléfono ya existe en otro cliente, salvo que el usuario lo haya
 * confirmado (FR-011). La regla se hace cumplir en el servidor.
 */
async function verificarTelefonoDuplicado(telefono, confirmado, excluirId = null) {
  if (confirmado) return;
  const coincidencias = await clientModel.findByPhoneDigits(soloDigitos(telefono), excluirId);
  if (coincidencias.length > 0) {
    throw errors.phoneDuplicateWarning(coincidencias.map(({ id, name }) => ({ id, name })));
  }
}

export async function createClient({ name, phone, email, address, confirmDuplicatePhone }) {
  await verificarTelefonoDuplicado(phone, confirmDuplicatePhone === true);
  const id = await clientModel.insert({
    name,
    phone,
    email: email ?? null,
    address: address ?? null
  });
  return clientModel.findById(id);
}

export async function listClients({ search, page, pageSize }) {
  const paginacion = normalizePagination({ page, pageSize });
  const { rows, total } = await clientModel.list({
    search: search || undefined,
    limit: paginacion.pageSize,
    offset: paginacion.offset
  });
  return { items: rows, total, page: paginacion.page, pageSize: paginacion.pageSize };
}

/** Detalle del cliente con los vehículos que tiene asociados (CA-4). */
export async function getClientById(id) {
  const cliente = await clientModel.findById(id);
  if (!cliente) throw errors.notFound('El cliente no existe.');
  const vehicles = await vehicleModel.listByClientId(id);
  return { ...cliente, vehicles };
}

export async function updateClient(id, datos) {
  const existente = await clientModel.findById(id);
  if (!existente) throw errors.notFound('El cliente no existe.');

  const { confirmDuplicatePhone, ...campos } = datos;
  const cambios = {};
  for (const clave of ['name', 'phone', 'email', 'address']) {
    if (campos[clave] !== undefined) cambios[clave] = campos[clave];
  }

  // Solo se advierte si el teléfono realmente cambia (comparando dígitos).
  if (
    cambios.phone !== undefined &&
    soloDigitos(cambios.phone) !== soloDigitos(existente.phone)
  ) {
    await verificarTelefonoDuplicado(cambios.phone, confirmDuplicatePhone === true, id);
  }

  await clientModel.update(id, cambios);
  return clientModel.findById(id);
}
