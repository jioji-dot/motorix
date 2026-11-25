// Configuración del taller y márgenes de «Próximo». Se lee de la base en cada consulta (sin caché) con respaldo a `.env`
// y a los valores de hoy (15 días y 500 km), así una instalación existente sigue funcionando (Sprint 7, FR-001 a FR-004).
import { env } from '../config/env.js';
import * as modeloConfiguracion from '../models/settingsModel.js';
import {
  AUDIT_ACTION,
  MAINTENANCE_WARNING_DAYS,
  MAINTENANCE_WARNING_KM,
  SETTING_KEY as K,
  SETTING_LIMITS as L,
} from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { auditService as bitacora } from './auditService.js';

const entero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN);

export function createSettingsService({ settingsModel = modeloConfiguracion, auditService = bitacora, config = env } = {}) {
  async function valores() {
    const g = await settingsModel.getAll();
    const numero = (clave, respaldo) => (g[clave] !== undefined && Number.isInteger(Number(g[clave])) ? Number(g[clave]) : respaldo);
    return {
      [K.WORKSHOP_NAME]: g[K.WORKSHOP_NAME] ?? config.workshop.name,
      [K.WORKSHOP_ADDRESS]: g[K.WORKSHOP_ADDRESS] ?? config.workshop.address,
      [K.WORKSHOP_PHONE]: g[K.WORKSHOP_PHONE] ?? config.workshop.phone,
      [K.WARN_DAYS]: numero(K.WARN_DAYS, MAINTENANCE_WARNING_DAYS),
      [K.WARN_KM]: numero(K.WARN_KM, MAINTENANCE_WARNING_KM),
    };
  }

  async function get() {
    const v = await valores();
    return {
      workshop: { name: v[K.WORKSHOP_NAME], address: v[K.WORKSHOP_ADDRESS], phone: v[K.WORKSHOP_PHONE] },
      maintenance: { warnDays: v[K.WARN_DAYS], warnKm: v[K.WARN_KM] },
      defaults: { warnDays: MAINTENANCE_WARNING_DAYS, warnKm: MAINTENANCE_WARNING_KM },
    };
  }

  async function getWorkshop() {
    return (await get()).workshop;
  }

  async function getMaintenanceMargins() {
    const { maintenance } = await get();
    return { dias: maintenance.warnDays, km: maintenance.warnKm };
  }

  function validar(cambios) {
    const problemas = [];
    const pares = {};
    const taller = cambios.workshop ?? {};
    const texto = (campo, clave, max, etiqueta, obligatorio) => {
      if (taller[campo] === undefined) return;
      const valor = typeof taller[campo] === 'string' ? taller[campo].trim() : '';
      if (obligatorio && valor === '') problemas.push({ field: `workshop.${campo}`, message: `${etiqueta} es obligatorio.` });
      else if (valor.length > max) problemas.push({ field: `workshop.${campo}`, message: `${etiqueta} no puede tener más de ${max} caracteres.` });
      else pares[clave] = valor;
    };
    texto('name', K.WORKSHOP_NAME, L.NAME_MAX, 'El nombre del taller', true);
    texto('address', K.WORKSHOP_ADDRESS, L.ADDRESS_MAX, 'La dirección', false);
    texto('phone', K.WORKSHOP_PHONE, L.PHONE_MAX, 'El teléfono', false);

    const mant = cambios.maintenance ?? {};
    const numerico = (campo, clave, limites, etiqueta, unidad) => {
      if (mant[campo] === undefined) return;
      const n = entero(mant[campo]);
      if (!Number.isInteger(n) || n < limites.min || n > limites.max) {
        problemas.push({ field: `maintenance.${campo}`, message: `${etiqueta} debe ser un número entero de ${limites.min} a ${limites.max.toLocaleString('en-US')} ${unidad}.` });
      } else pares[clave] = n;
    };
    numerico('warnDays', K.WARN_DAYS, L.WARN_DAYS, 'Los días de margen', 'días');
    numerico('warnKm', K.WARN_KM, L.WARN_KM, 'Los kilómetros de margen', 'km');

    if (problemas.length > 0) throw HttpError.validation('Revisa los datos enviados.', problemas);
    return pares;
  }

  async function update(cambios, usuario) {
    const pares = validar(cambios ?? {});
    if (Object.keys(pares).length === 0) return get();
    const antes = await valores();
    const modificados = Object.entries(pares).filter(([clave, valor]) => String(antes[clave]) !== String(valor));
    await settingsModel.saveMany(pares, usuario.id);
    if (modificados.length > 0) {
      await auditService.record(AUDIT_ACTION.SETTINGS_CHANGED, {
        userId: usuario.id,
        detail: { changes: modificados.map(([clave, valor]) => ({ key: clave, from: antes[clave], to: valor })) },
      });
    }
    return get();
  }

  return { get, update, getWorkshop, getMaintenanceMargins };
}

export const settingsService = createSettingsService();
