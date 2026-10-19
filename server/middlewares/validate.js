// Valida el cuerpo, los parámetros o la consulta con un esquema zod y devuelve mensajes en español.
import { HttpError } from '../utils/httpError.js';

export function validate(esquema, origen = 'body') {
  return (req, _res, next) => {
    const resultado = esquema.safeParse(req[origen] ?? {});
    if (!resultado.success) {
      const detalles = resultado.error.issues.map((problema) => ({
        field: problema.path.join('.'),
        message: problema.message,
      }));
      return next(HttpError.validation('Revisa los datos enviados.', detalles));
    }
    // Los servicios reciben los datos ya normalizados por el esquema.
    req.valid = { ...(req.valid ?? {}), [origen]: resultado.data };
    return next();
  };
}
