import { env } from '../config/env.js';
import { mercadoPagoService } from '../services/mercadoPagoService.js';
import { paymentService } from '../services/paymentService.js';
import { parseNotification, verifySignature } from '../services/webhookVerifier.js';
import { HttpError } from '../utils/httpError.js';

export async function listByOrder(req, res) {
  res.json({ data: await paymentService.list(req.valid.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await paymentService.create(req.valid.params.id, req.valid.body, req.user) });
}

export async function sync(req, res) {
  res.json({ data: await mercadoPagoService.sync(req.valid.params.id) });
}

export async function cancel(req, res) {
  res.json({ data: await mercadoPagoService.cancel(req.valid.params.id) });
}

// Notificación pública de Mercado Pago: no usa sesión; el servidor verifica el pago real contra Mercado Pago.
export async function webhook(req, res) {
  const notificacion = parseNotification({ body: req.body, query: req.query });
  if (!notificacion) throw HttpError.validation('La notificación no tiene el formato esperado.');
  if (notificacion.type !== 'payment') return res.json({ data: { received: true } });

  const secreto = env.mercadoPago.webhookSecret;
  if (secreto) {
    const valida = verifySignature({
      secret: secreto,
      signatureHeader: req.headers['x-signature'],
      requestId: req.headers['x-request-id'],
      dataId: notificacion.dataId,
    });
    if (!valida) throw new HttpError(401, 'INVALID_SIGNATURE', 'La firma de la notificación no es válida.');
  }
  await mercadoPagoService.handleNotification(notificacion.dataId);
  return res.json({ data: { received: true } });
}
