// Encabezados de seguridad de las respuestas de la API. Código propio: el proyecto no usa `helmet` ni dependencias nuevas
// (Sprint 7, FR-029). Las respuestas de la API no se guardan en caché y no revelan la tecnología del servidor.
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('X-Powered-By');
  next();
}
