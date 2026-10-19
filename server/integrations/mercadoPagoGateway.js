// Única pieza que conoce la API de Mercado Pago. Se usa solo en modo de pruebas (sandbox) con el `fetch` nativo de Node.
// El token de acceso viene de variables de entorno y NUNCA se escribe en errores, mensajes ni registros.
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const TIEMPO_DE_ESPERA_MS = 10000;

const noDisponible = () =>
  new HttpError(502, 'MP_UNAVAILABLE', 'Mercado Pago no está disponible por ahora. Intenta de nuevo o cobra con otro método.');

export function createMercadoPagoGateway({ config = env.mercadoPago, fetchFn = (...args) => fetch(...args) } = {}) {
  const isConfigured = () => Boolean(config.accessToken);

  async function llamar(metodo, ruta, cuerpo) {
    if (!isConfigured()) {
      throw new HttpError(503, 'MP_NOT_CONFIGURED', 'Mercado Pago no está configurado en este servidor. Cobra con otro método.');
    }
    let respuesta;
    try {
      respuesta = await fetchFn(`${config.apiUrl}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: AbortSignal.timeout(TIEMPO_DE_ESPERA_MS),
      });
    } catch {
      // Red caída o tiempo de espera agotado: el detalle técnico no se expone.
      throw noDisponible();
    }
    if (!respuesta.ok) {
      const error = noDisponible();
      error.notFound = respuesta.status === 404;
      throw error;
    }
    try {
      return await respuesta.json();
    } catch {
      throw noDisponible();
    }
  }

  const aPagoExterno = (datos) => ({
    id: String(datos.id),
    status: datos.status,
    externalReference: datos.external_reference ?? null,
    amount: Number(datos.transaction_amount),
  });

  return {
    isConfigured,

    // Crea una preferencia de pago y devuelve el enlace para que el cliente pague en la página de Mercado Pago.
    async createPaymentLink({ amount, description, externalReference }) {
      const cuerpo = {
        items: [{ title: description, quantity: 1, unit_price: Number(amount), currency_id: 'MXN' }],
        external_reference: externalReference,
        ...(config.notificationUrl ? { notification_url: config.notificationUrl } : {}),
      };
      const datos = await llamar('POST', '/checkout/preferences', cuerpo);
      const link = datos.sandbox_init_point || datos.init_point;
      if (!link) throw noDisponible();
      return { preferenceId: String(datos.id), link };
    },

    // Consulta un pago de Mercado Pago por su identificador. Devuelve null si no existe.
    async getPayment(externalId) {
      if (!/^\d{1,20}$/.test(String(externalId))) return null;
      try {
        return aPagoExterno(await llamar('GET', `/v1/payments/${externalId}`));
      } catch (error) {
        if (error.code === 'MP_UNAVAILABLE' && error.notFound) return null;
        throw error;
      }
    },

    // Busca el pago más reciente asociado a una referencia propia (para sincronizar sin conocer su identificador).
    async findPaymentByReference(externalReference) {
      const datos = await llamar(
        'GET',
        `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`,
      );
      const primero = datos.results?.[0];
      return primero ? aPagoExterno(primero) : null;
    },
  };
}

export const mercadoPagoGateway = createMercadoPagoGateway();
