import { env } from '../config/env.js';
import { renderTicketError, renderTicketHtml } from '../services/ticketPrint.js';
import { ticketService } from '../services/ticketService.js';

export async function generate(req, res) {
  const { ticket, created } = await ticketService.generate(req.valid.params.id, req.user);
  res.status(created ? 201 : 200).json({ data: ticket });
}

export async function get(req, res) {
  res.json({ data: await ticketService.get(req.valid.params.id) });
}

// Emite un enlace de impresión de corta vida para abrir el ticket en el navegador del sistema.
export async function printLink(req, res) {
  const { token, expiresInSeconds } = await ticketService.createPrintToken(req.valid.params.id);
  const base = env.publicUrl || `${req.protocol}://${req.get('host')}/api`;
  res.json({ data: { url: `${base.replace(/\/+$/, '')}/tickets/print/${token}`, expiresInSeconds } });
}

// Página imprimible (pública, protegida por el token de impresión).
export async function printPage(req, res) {
  try {
    const contenido = await ticketService.contentForPrintToken(req.valid.params.token);
    res.type('html').send(renderTicketHtml(contenido));
  } catch (error) {
    if (!error.status) throw error;
    res.status(error.status).type('html').send(renderTicketError(error.message));
  }
}
