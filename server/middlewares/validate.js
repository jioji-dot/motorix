// Validación de body, query y params con esquemas zod.
// Los valores validados (ya normalizados) reemplazan a los originales en `req.valid`.

/**
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} esquemas
 */
export function validate(esquemas) {
  return (req, res, next) => {
    try {
      req.valid = {};
      for (const parte of ['params', 'query', 'body']) {
        if (esquemas[parte]) {
          req.valid[parte] = esquemas[parte].parse(req[parte] ?? {});
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
