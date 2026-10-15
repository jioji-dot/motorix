// Lectura de `app_settings`: configuración editable con SQL (umbrales de mantenimiento, RN-12).
import { pool } from '../config/database.js';
import {
  DEFAULT_WORKSHOP,
  DEFAULT_MAINTENANCE_WARNING_DAYS,
  DEFAULT_MAINTENANCE_WARNING_KM
} from '../config/constants.js';

const entero = (valor, respaldo) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : respaldo;
};

/** Umbrales de aviso; usa el respaldo si falta la clave o el valor no es un entero positivo. */
export async function getMaintenanceThresholds(db = pool) {
  const [filas] = await db.query(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('maintenance_warning_days', 'maintenance_warning_km')"
  );
  const valores = Object.fromEntries(filas.map((f) => [f.setting_key, f.setting_value]));
  return {
    warningDays: entero(valores.maintenance_warning_days, DEFAULT_MAINTENANCE_WARNING_DAYS),
    warningKm: entero(valores.maintenance_warning_km, DEFAULT_MAINTENANCE_WARNING_KM)
  };
}

/** Datos del taller para el ticket; usa los predeterminados cuando falta una clave o está vacía. */
export async function getWorkshopSettings(db = pool) {
  const [filas] = await db.query(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('workshop_name', 'workshop_address', 'workshop_phone')"
  );
  const valores = Object.fromEntries(filas.map((f) => [f.setting_key, String(f.setting_value ?? '').trim()]));
  return {
    name: valores.workshop_name || DEFAULT_WORKSHOP.name,
    address: valores.workshop_address || DEFAULT_WORKSHOP.address,
    phone: valores.workshop_phone || DEFAULT_WORKSHOP.phone
  };
}
