// Cliente de Mercado Pago: es la única parte del sistema que conoce su API (research D4).
// Usa `fetch` de Node (sin SDK ni dependencias). El pago ocurre en la página de Mercado Pago: el
// sistema nunca recibe ni guarda datos de tarjeta, y el token no se registra ni se propaga.
import { env } from '../config/env.js';

/** Error controlado del cliente: `MP_NOT_CONFIGURED` o `MP_UNAVAILABLE`. Nunca incluye el token. */
export class MercadoPagoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MercadoPagoError';
    this.code = code;
  }
}

const noConfigurado = () =>
  new MercadoPagoError('MP_NOT_CONFIGURED', 'Mercado Pago no está configurado en el servidor.');
const noDisponible = (motivo) =>
  new MercadoPagoError('MP_UNAVAILABLE', `Mercado Pago no respondió correctamente (${motivo}).`);

/** Llama a la API con el token, el tiempo de espera y la validación de la respuesta. */
async function llamar(ruta, { method = 'GET', body } = {}) {
  const { accessToken, apiUrl, timeoutMs } = env.mercadoPago;
  if (!accessToken) throw noConfigurado();

  let respuesta;
  try {
    respuesta = await fetch(`${apiUrl}${ruta}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    // Sin detalles del error original: podrían incluir datos de la solicitud.
    throw noDisponible(error?.name === 'TimeoutError' ? 'tiempo de espera agotado' : 'sin conexión');
  }

  if (!respuesta.ok) throw noDisponible(`estado ${respuesta.status}`);
  try {
    return await respuesta.json();
  } catch {
    throw noDisponible('respuesta inválida');
  }
}

/**
 * Crea una preferencia de pago y devuelve el enlace donde el cliente paga.
 * En modo `sandbox` usa el enlace de pruebas (`sandbox_init_point`).
 * @returns {Promise<{preferenceId: string, paymentUrl: string}>}
 */
export async function createPreference({ title, amount, externalReference }) {
  const datos = await llamar('/checkout/preferences', {
    method: 'POST',
    body: {
      items: [{ title, quantity: 1, unit_price: amount, currency_id: 'MXN' }],
      external_reference: externalReference
    }
  });

  const enlace = env.mercadoPago.mode === 'sandbox' ? datos?.sandbox_init_point : datos?.init_point;
  if (!datos?.id || typeof enlace !== 'string' || !enlace) throw noDisponible('respuesta incompleta');
  return { preferenceId: String(datos.id), paymentUrl: enlace };
}

/**
 * Busca el pago asociado a la referencia externa. Prefiere el aprobado; si no hay, el más reciente.
 * @returns {Promise<{id: string, status: string} | null>} null cuando aún no hay pagos
 */
export async function findPaymentByReference(externalReference) {
  const consulta = new URLSearchParams({
    external_reference: externalReference,
    sort: 'date_created',
    criteria: 'desc'
  });
  const datos = await llamar(`/v1/payments/search?${consulta}`);
  if (!Array.isArray(datos?.results)) throw noDisponible('respuesta incompleta');
  if (datos.results.length === 0) return null;

  const aprobado = datos.results.find((p) => p.status === 'approved');
  const elegido =
    aprobado ??
    [...datos.results].sort((a, b) => new Date(b.date_created ?? 0) - new Date(a.date_created ?? 0))[0];
  return { id: String(elegido.id), status: String(elegido.status) };
}
