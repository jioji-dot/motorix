import * as ticketService from '../services/ticketService.js';
import { ok, okList } from '../utils/response.js';

/** Genera el ticket: 201 si lo crea, 200 si ya existía. */
export async function generate(req, res, next) {
  try {
    const { ticket, created } = await ticketService.generateTicket(req.user, req.valid.params.id);
    ok(res, ticket, created ? 201 : 200);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await ticketService.getTicket(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await ticketService.listTickets(req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}
