import { env } from '../config/env.js';

// Pasarela de Mercado Pago simulada para las pruebas: nunca llama a la red. El resultado se controla desde la prueba.
export function crearPasarelaSimulada({ configurada = true } = {}) {
  const estado = {
    configurada,
    falla: null, // si se asigna un Error, createPaymentLink y getPayment lo lanzan
    pagos: new Map(), // externalId → { id, status, externalReference, amount }
    llamadas: [],
    siguienteId: 5000,
  };

  return {
    estado,
    isConfigured: () => estado.configurada,

    async createPaymentLink({ amount, description, externalReference }) {
      estado.llamadas.push({ operacion: 'createPaymentLink', amount, description, externalReference });
      if (estado.falla) throw estado.falla;
      return { preferenceId: `pref-${externalReference}`, link: `https://sandbox.mercadopago.test/pagar/${externalReference}` };
    },

    async getPayment(externalId) {
      estado.llamadas.push({ operacion: 'getPayment', externalId });
      if (estado.falla) throw estado.falla;
      return estado.pagos.get(String(externalId)) ?? null;
    },

    async findPaymentByReference(externalReference) {
      estado.llamadas.push({ operacion: 'findPaymentByReference', externalReference });
      if (estado.falla) throw estado.falla;
      const coincidencias = [...estado.pagos.values()].filter((p) => p.externalReference === externalReference);
      return coincidencias.at(-1) ?? null;
    },

    // Simula que el cliente pagó (o fue rechazado) en Mercado Pago. Devuelve el identificador externo.
    registrarPagoExterno({ externalReference, amount, status = 'approved' }) {
      const id = String(estado.siguienteId++);
      estado.pagos.set(id, { id, status, externalReference, amount: Number(amount) });
      return id;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Mercado Pago simulado a nivel de red, para las pruebas de integración: reemplaza `fetch` solo para las direcciones
// de Mercado Pago, de modo que el flujo completo (pasarela real incluida) se prueba sin salir a internet.
// ---------------------------------------------------------------------------------------------------------------
// Los identificadores externos son únicos en todas las pruebas, como los de Mercado Pago (la columna es UNIQUE).
let contadorExterno = 7000;

export function instalarMercadoPagoSimulado({ configurado = true } = {}) {
  const fetchOriginal = globalThis.fetch;
  const tokenOriginal = env.mercadoPago.accessToken;
  const estado = { preferencias: [], pagos: new Map(), caido: false, llamadas: [] };
  env.mercadoPago.accessToken = configurado ? 'TEST-token-de-prueba' : '';

  const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
  const aApi = (p) => ({ id: p.id, status: p.status, external_reference: p.externalReference, transaction_amount: p.amount });

  globalThis.fetch = async (url, opciones = {}) => {
    const direccion = String(url);
    if (!direccion.startsWith(env.mercadoPago.apiUrl)) return fetchOriginal(url, opciones);
    const ruta = direccion.slice(env.mercadoPago.apiUrl.length);
    estado.llamadas.push({ metodo: opciones.method ?? 'GET', ruta, autorizacion: opciones.headers?.Authorization });
    if (estado.caido) throw new Error('red caída');

    if (ruta === '/checkout/preferences') {
      const cuerpo = JSON.parse(opciones.body);
      estado.preferencias.push(cuerpo);
      return json({ id: `pref-${estado.preferencias.length}`, sandbox_init_point: `https://sandbox.mercadopago.test/pagar/${cuerpo.external_reference}` }, 201);
    }
    const busqueda = ruta.match(/^\/v1\/payments\/search\?external_reference=([^&]+)/);
    if (busqueda) {
      const referencia = decodeURIComponent(busqueda[1]);
      return json({ results: [...estado.pagos.values()].filter((p) => p.externalReference === referencia).map(aApi) });
    }
    const uno = ruta.match(/^\/v1\/payments\/(\d+)$/);
    if (uno) {
      const pago = estado.pagos.get(uno[1]);
      return pago ? json(aApi(pago)) : json({ message: 'not found' }, 404);
    }
    return json({ message: 'ruta no simulada' }, 404);
  };

  return {
    estado,
    // Simula que el cliente pagó (o fue rechazado) en Mercado Pago. Devuelve el identificador externo.
    registrarPagoExterno({ externalReference, amount, status = 'approved' }) {
      const id = String(contadorExterno++);
      estado.pagos.set(id, { id, status, externalReference, amount: Number(amount) });
      return id;
    },
    restaurar() {
      globalThis.fetch = fetchOriginal;
      env.mercadoPago.accessToken = tokenOriginal;
    },
  };
}
