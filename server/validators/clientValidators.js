// Esquemas de validación de clientes.
import { z } from 'zod';
import { listQuery, optionalEmail, optionalString, requiredString } from './common.js';

/** Teléfono de 7 a 15 dígitos; admite +, espacios, guiones y paréntesis al capturar. */
function phoneField() {
  return requiredString('El teléfono', { max: 20 }).refine(
    (valor) => {
      if (!/^\+?[0-9\s\-()]+$/.test(valor)) return false;
      const digitos = valor.replace(/\D/g, '').length;
      return digitos >= 7 && digitos <= 15;
    },
    'El teléfono debe tener entre 7 y 15 dígitos y solo admite números, espacios, guiones o el signo +.'
  );
}

const camposCliente = {
  name: requiredString('El nombre', { max: 120 }),
  phone: phoneField(),
  email: optionalEmail('El correo electrónico'),
  address: optionalString('La dirección', { max: 255 }),
  confirmDuplicatePhone: z.boolean({ invalid_type_error: 'La confirmación debe ser verdadero o falso.' }).optional()
};

export const createClientBody = z.object(camposCliente);

export const updateClientBody = z
  .object(camposCliente)
  .partial()
  .refine(
    (datos) => ['name', 'phone', 'email', 'address'].some((campo) => datos[campo] !== undefined),
    'Debes indicar al menos un dato del cliente para actualizar.'
  );

export const listClientsQuery = z.object(listQuery);
