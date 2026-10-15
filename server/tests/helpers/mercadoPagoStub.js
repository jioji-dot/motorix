// Servidor HTTP local que imita las dos rutas de Mercado Pago que usa el sistema, para probar sin red
// ni cuentas reales (FR-032):
//   POST /checkout/preferences   → crea una preferencia de pago (requiere Authorization: Bearer)
//   GET  /v1/payments/search     → devuelve los pagos configurados para una referencia externa
import http from 'node:http';

export const STUB_TOKEN = 'TEST-token-secreto-9876';

let servidor = null;
let preferenciasCreadas = 0;
const pagos = new Map();
let falla = null;

/** Solicitudes recibidas: { method, path, query, headers, body }. */
export const requests = [];

/** Cambia el modo de falla: null, 'error500', 'invalidJson' o 'slow' (responde tras 1.5 s). */
export function setFailure(modo) {
  falla = modo;
}

/** Define los pagos que devuelve la búsqueda para una referencia externa. */
export function setPayments(referencia, lista) {
  pagos.set(referencia, lista);
}

export function reset() {
  requests.length = 0;
  pagos.clear();
  falla = null;
  preferenciasCreadas = 0;
}

function responder(res, status, cuerpo) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
}

async function manejar(req, res) {
  const url = new URL(req.url, 'http://stub');
  let texto = '';
  for await (const trozo of req) texto += trozo;
  let cuerpo = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }
  requests.push({
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: req.headers,
    body: cuerpo
  });

  if (req.headers.authorization !== `Bearer ${STUB_TOKEN}`) {
    return responder(res, 401, { message: 'invalid access token', status: 401 });
  }
  if (falla === 'error500') return responder(res, 500, { message: 'internal error' });
  if (falla === 'invalidJson') return responder(res, 200, '<html>no es json</html>');
  if (falla === 'slow') await new Promise((r) => setTimeout(r, 1500));

  if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
    preferenciasCreadas += 1;
    const id = `PREF-${preferenciasCreadas}`;
    return responder(res, 201, {
      id,
      init_point: `https://mp.test/checkout/${id}`,
      sandbox_init_point: `https://sandbox.mp.test/checkout/${id}`
    });
  }

  if (req.method === 'GET' && url.pathname === '/v1/payments/search') {
    const referencia = url.searchParams.get('external_reference');
    return responder(res, 200, { results: pagos.get(referencia) ?? [] });
  }

  return responder(res, 404, { message: 'not found' });
}

/** Levanta el servidor en un puerto libre y apunta el entorno hacia él. */
export async function start() {
  servidor = http.createServer((req, res) => {
    manejar(req, res).catch(() => responder(res, 500, { message: 'stub error' }));
  });
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const { port } = servidor.address();
  process.env.MP_API_URL = `http://127.0.0.1:${port}`;
  process.env.MP_ACCESS_TOKEN = STUB_TOKEN;
  process.env.MP_MODE = 'sandbox';
  process.env.MP_TIMEOUT_MS = '10000';
  return `http://127.0.0.1:${port}`;
}

export async function stop() {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  servidor = null;
  delete process.env.MP_API_URL;
  delete process.env.MP_ACCESS_TOKEN;
  delete process.env.MP_MODE;
  delete process.env.MP_TIMEOUT_MS;
}
