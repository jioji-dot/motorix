// Lectura y validación de las variables de entorno.
// Las variables se cargan con `node --env-file` (sin dependencia `dotenv`).

const obligatorias = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

const faltantes = obligatorias.filter((nombre) => !process.env[nombre]);
if (faltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${faltantes.join(', ')}. ` +
      'Copia .env.example a .env y completa los valores.'
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME
  },
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean),
  // Mercado Pago es opcional: sin token el cobro digital responde un mensaje claro.
  // Se lee del entorno en cada uso (getters) para que las pruebas puedan apuntar a un servidor simulado.
  mercadoPago: {
    get accessToken() {
      return process.env.MP_ACCESS_TOKEN || '';
    },
    get apiUrl() {
      return (process.env.MP_API_URL || 'https://api.mercadopago.com').replace(/\/+$/, '');
    },
    get mode() {
      return process.env.MP_MODE || 'sandbox';
    },
    get timeoutMs() {
      return Number(process.env.MP_TIMEOUT_MS || 10000);
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  }
};
