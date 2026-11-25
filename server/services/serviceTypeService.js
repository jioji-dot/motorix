// Catálogo de tipos de servicio con intervalos de mantenimiento (RN-12). Nunca se borra un tipo (Sprint 7, FR-005, FR-006).
import * as modeloTipos from '../models/serviceTypeModel.js';
import { AUDIT_ACTION } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { auditService as bitacora } from './auditService.js';

const duplicado = () => new HttpError(409, 'SERVICE_TYPE_DUPLICATE', 'Ya existe un tipo de servicio con ese nombre.');

export function createServiceTypeService({ serviceTypeModel = modeloTipos, auditService = bitacora } = {}) {
  // Los administradores ven todos los tipos; recepción y mecánico, solo los activos (para elegir en las líneas).
  const list = (usuario) => serviceTypeModel.list({ onlyActive: usuario.role !== 'ADMIN' });

  async function create(datos, usuario) {
    let id;
    try {
      id = await serviceTypeModel.create(datos);
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw duplicado();
      throw error;
    }
    await auditService.record(AUDIT_ACTION.SERVICE_TYPE_CREATED, { userId: usuario.id, entityId: id, detail: { name: datos.name } });
    return serviceTypeModel.findById(id);
  }

  async function update(id, cambios, usuario) {
    const actual = await serviceTypeModel.findById(id);
    if (!actual) throw HttpError.notFound('No se encontró el tipo de servicio solicitado.');
    // El resultado final debe conservar al menos un intervalo.
    const final = { ...actual, ...cambios };
    if ((final.intervalDays ?? null) === null && (final.intervalKm ?? null) === null) {
      throw HttpError.validation('Revisa los datos enviados.', [{ field: 'intervalDays', message: 'Indica el intervalo en días, en kilómetros o en ambos.' }]);
    }
    try {
      await serviceTypeModel.update(id, cambios);
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw duplicado();
      throw error;
    }
    const modificados = Object.keys(cambios)
      .filter((k) => String(actual[k] ?? null) !== String(cambios[k] ?? null))
      .map((k) => ({ key: k, from: actual[k] ?? null, to: cambios[k] ?? null }));
    await auditService.record(AUDIT_ACTION.SERVICE_TYPE_UPDATED, { userId: usuario.id, entityId: id, detail: { changes: modificados } });
    return serviceTypeModel.findById(id);
  }

  return { list, create, update };
}

export const serviceTypeService = createServiceTypeService();
