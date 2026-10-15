// CORS mínimo (sin dependencias) para que la aplicación Flutter web pueda llamar a la API.
//
// - CORS_ORIGIN (opcional): orígenes permitidos separados por comas.
// - Sin CORS_ORIGIN y fuera de producción: se permite cualquier origen localhost / 127.0.0.1.
import { env } from '../config/env.js';

const ORIGEN_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function origenPermitido(origen) {
  if (!origen) return false;
  if (env.corsOrigins.length > 0) return env.corsOrigins.includes(origen);
  return env.nodeEnv !== 'production' && ORIGEN_LOCAL.test(origen);
}

export function cors(req, res, next) {
  const origen = req.headers.origin;
  if (origenPermitido(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}
