// Esquema de publicación de términos y condiciones (mensajes en español). Sprint 7, FR-018.
import { z } from 'zod';
import { TERMS_TEXT_MAX } from '../utils/constants.js';

const texto = (etiqueta) =>
  z
    .string({ required_error: `${etiqueta} es obligatorio.`, invalid_type_error: `${etiqueta} no es válido.` })
    .trim()
    .min(1, `${etiqueta} es obligatorio.`)
    .max(TERMS_TEXT_MAX, `${etiqueta} no puede tener más de ${TERMS_TEXT_MAX.toLocaleString('en-US')} caracteres.`);

export const publishTermsSchema = z.object({ termsText: texto('El texto de los términos'), privacyText: texto('El aviso de privacidad') });
