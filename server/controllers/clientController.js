import * as clientService from '../services/clientService.js';
import { ok, okList } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await clientService.listClients(req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await clientService.createClient(req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await clientService.getClientById(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await clientService.updateClient(req.valid.params.id, req.valid.body));
  } catch (error) {
    next(error);
  }
}
