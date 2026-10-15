// Regla de kilometraje compartida por vehículos y órdenes (RN-3 y RN-4).
import { errors } from '../utils/AppError.js';

/**
 * Valida un kilometraje nuevo contra el registrado del vehículo.
 * - Debe ser un entero no negativo.
 * - No puede ser menor al registrado salvo corrección explícita.
 * - Un vehículo en 0 (sin kilometraje previo) acepta cualquier valor válido.
 * @returns {number} el kilometraje validado
 */
export function validateEntryMileage({ currentMileage, entryMileage, mileageCorrection = false }) {
  if (!Number.isInteger(entryMileage) || entryMileage < 0) {
    throw errors.validation('El kilometraje debe ser un número entero no negativo.', [
      { field: 'entryMileage', message: 'El kilometraje debe ser un número entero no negativo.' }
    ]);
  }
  if (entryMileage < currentMileage && mileageCorrection !== true) {
    throw errors.mileageDecrease();
  }
  return entryMileage;
}
