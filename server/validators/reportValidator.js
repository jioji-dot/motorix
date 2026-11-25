// Parámetros de los reportes (mensajes en español). Sprint 7, FR-014.
import { z } from 'zod';
import { REPORT_MAX_DAYS, REPORT_NAMES } from '../utils/constants.js';
import { fechaSchema } from './commonValidator.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const aUtc = (texto) => Date.UTC(...texto.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));

export const reportRangeSchema = z
  .object({
    from: fechaSchema,
    to: fechaSchema,
    groupBy: z.enum(['day', 'month'], { errorMap: () => ({ message: 'Agrupa por día (day) o por mes (month).' }) }).default('day'),
  })
  .superRefine((datos, contexto) => {
    const dias = (aUtc(datos.to) - aUtc(datos.from)) / MS_POR_DIA + 1;
    if (dias < 1) contexto.addIssue({ code: 'custom', path: ['to'], message: 'La fecha final no puede ser anterior a la inicial.' });
    else if (dias > REPORT_MAX_DAYS) {
      contexto.addIssue({ code: 'custom', path: ['to'], message: `El rango no puede ser de más de ${REPORT_MAX_DAYS} días.` });
    }
  });

export const reportNameParamSchema = z.object({
  name: z.enum(REPORT_NAMES, { errorMap: () => ({ message: 'El reporte no existe.' }) }),
});
