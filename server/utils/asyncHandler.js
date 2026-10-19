// Envuelve un controlador asíncrono para que sus errores lleguen al manejador centralizado.
export const asyncHandler = (funcion) => (req, res, next) => {
  Promise.resolve(funcion(req, res, next)).catch(next);
};
