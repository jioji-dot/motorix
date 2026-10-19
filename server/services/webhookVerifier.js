// Verificación de las notificaciones (webhooks) de Mercado Pago.
import crypto from 'node:crypto';

// Extrae el tipo y el identificador del pago de una notificación, venga en el cuerpo o en la dirección.
// Devuelve null si la notificación está mal formada.
export function parseNotification({ body = {}, query = {} }) {
  const tipo = body?.type ?? body?.topic ?? query?.type ?? query?.topic ?? null;
  const id = body?.data?.id ?? query?.['data.id'] ?? (tipo === 'payment' ? query?.id : undefined) ?? null;
  if (typeof tipo !== 'string' || tipo.trim() === '') return null;
  if (tipo !== 'payment') return { type: tipo, dataId: null };
  if (id === null || !/^\d{1,20}$/.test(String(id))) return null;
  return { type: 'payment', dataId: String(id) };
}

// Valida la firma `x-signature` (formato "ts=...,v1=...") según la documentación de Mercado Pago.
export function verifySignature({ secret, signatureHeader, requestId, dataId }) {
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;
  const partes = Object.fromEntries(
    signatureHeader.split(',').map((parte) => {
      const [clave, ...valor] = parte.trim().split('=');
      return [clave, valor.join('=')];
    }),
  );
  if (!partes.ts || !partes.v1) return false;
  const manifiesto = `id:${String(dataId).toLowerCase()};request-id:${requestId ?? ''};ts:${partes.ts};`;
  const esperada = crypto.createHmac('sha256', secret).update(manifiesto).digest('hex');
  const recibida = Buffer.from(partes.v1, 'utf8');
  const calculada = Buffer.from(esperada, 'utf8');
  return recibida.length === calculada.length && crypto.timingSafeEqual(recibida, calculada);
}

// Calcula la firma que enviaría Mercado Pago (útil en las pruebas).
export function signNotification({ secret, requestId, dataId, ts }) {
  const manifiesto = `id:${String(dataId).toLowerCase()};request-id:${requestId ?? ''};ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(manifiesto).digest('hex')}`;
}
