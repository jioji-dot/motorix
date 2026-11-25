// Esquema de la configuración. Solo valida la forma: los límites y los mensajes los aplica settingsService.
import { z } from 'zod';

const MENSAJE = 'Hay campos que no se pueden configurar.';
const valor = z.union([z.string(), z.number()]);

export const updateSettingsSchema = z
  .object(
    {
      workshop: z
        .object({ name: valor.optional(), address: valor.optional(), phone: valor.optional() }, { errorMap: () => ({ message: MENSAJE }) })
        .strict()
        .optional(),
      maintenance: z
        .object({ warnDays: valor.optional(), warnKm: valor.optional() }, { errorMap: () => ({ message: MENSAJE }) })
        .strict()
        .optional(),
    },
    { errorMap: () => ({ message: MENSAJE }) },
  )
  .strict();
