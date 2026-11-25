// Esquemas de validación de avisos y de avisos a clientes (mensajes en español). Sprint 6.
import { z } from 'zod';
import { CLIENT_NOTICE_KINDS, CLIENT_NOTICE_NOTE_MAX } from '../utils/constants.js';
import { parseKey } from '../services/noticeKeys.js';

export const readNoticeSchema = z.object({
  key: z
    .string({ required_error: 'La clave del aviso es obligatoria.', invalid_type_error: 'La clave del aviso no es válida.' })
    .trim()
    .min(1, 'La clave del aviso es obligatoria.')
    .max(60, 'La clave del aviso no es válida.')
    .refine((valor) => parseKey(valor) !== null, 'La clave del aviso no es válida.'),
});

const nota = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
  z
    .string({ invalid_type_error: 'La nota no es válida.' })
    .trim()
    .max(CLIENT_NOTICE_NOTE_MAX, `La nota no puede tener más de ${CLIENT_NOTICE_NOTE_MAX} caracteres.`)
    .nullable()
    .optional(),
);

export const createClientNoticeSchema = z.object({
  kind: z.enum(CLIENT_NOTICE_KINDS, {
    errorMap: () => ({ message: `El motivo debe ser uno de: ${CLIENT_NOTICE_KINDS.join(', ')}.` }),
  }),
  factId: z
    .number({ required_error: 'El hecho es obligatorio.', invalid_type_error: 'El hecho no es válido.' })
    .int('El hecho no es válido.')
    .positive('El hecho no es válido.'),
  note: nota,
});

export const clientNoticeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'La página debe ser 1 o mayor.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'El tamaño de página debe ser 1 o mayor.')
    .max(100, 'El tamaño de página no puede ser mayor a 100.')
    .default(50),
});
