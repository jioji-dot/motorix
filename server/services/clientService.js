// Lógica de negocio de clientes.
import * as modeloClientes from '../models/clientModel.js';
import { HttpError } from '../utils/httpError.js';

function avisoTelefonoRepetido(coincidencias) {
  return new HttpError(
    409,
    'DUPLICATE_PHONE',
    'Ya existe un cliente con ese teléfono. Confirma si quieres registrarlo de todos modos.',
    coincidencias.map(({ id, name, phone }) => ({ id, name, phone })),
  );
}

export function createClientService({ clientModel = modeloClientes } = {}) {
  async function list(filtros) {
    const { items, total } = await clientModel.list(filtros);
    return { items, meta: { page: filtros.page, pageSize: filtros.pageSize, total } };
  }

  async function get(id) {
    const cliente = await clientModel.findById(id);
    if (!cliente) throw HttpError.notFound('No se encontró el cliente solicitado.');
    const vehicles = await clientModel.findVehiclesByClientId(id);
    return { ...cliente, vehicles };
  }

  // Un teléfono repetido avisa (409) y solo se acepta si la petición lo confirma (FR-017).
  async function create({ confirmDuplicatePhone, ...datos }) {
    if (!confirmDuplicatePhone) {
      const coincidencias = await clientModel.findByPhone(datos.phone);
      if (coincidencias.length > 0) throw avisoTelefonoRepetido(coincidencias);
    }
    return clientModel.create(datos);
  }

  async function update(id, { confirmDuplicatePhone, ...datos }) {
    const actual = await clientModel.findById(id);
    if (!actual) throw HttpError.notFound('No se encontró el cliente solicitado.');

    if (datos.phone !== undefined && datos.phone !== actual.phone && !confirmDuplicatePhone) {
      const coincidencias = await clientModel.findByPhone(datos.phone, id);
      if (coincidencias.length > 0) throw avisoTelefonoRepetido(coincidencias);
    }
    // Desactivar es lógico: el cliente y sus vehículos se conservan (FR-019).
    return clientModel.update(id, datos);
  }

  return { list, get, create, update };
}

export const clientService = createClientService();
