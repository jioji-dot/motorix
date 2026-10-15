import * as inventoryService from '../services/inventoryService.js';
import { ok, okList } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await inventoryService.listParts(req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await inventoryService.createPart(req.user, req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await inventoryService.getPart(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await inventoryService.updatePart(req.valid.params.id, req.valid.body));
  } catch (error) {
    next(error);
  }
}

export async function deactivate(req, res, next) {
  try {
    ok(res, await inventoryService.setPartActive(req.valid.params.id, false));
  } catch (error) {
    next(error);
  }
}

export async function activate(req, res, next) {
  try {
    ok(res, await inventoryService.setPartActive(req.valid.params.id, true));
  } catch (error) {
    next(error);
  }
}

export async function registerEntry(req, res, next) {
  try {
    ok(res, await inventoryService.registerEntry(req.user, req.valid.params.id, req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function registerAdjustment(req, res, next) {
  try {
    ok(res, await inventoryService.registerAdjustment(req.user, req.valid.params.id, req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function listMovements(req, res, next) {
  try {
    const { items, total, page, pageSize } = await inventoryService.listMovements(
      req.valid.params.id,
      req.valid.query
    );
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function available(req, res, next) {
  try {
    ok(res, await inventoryService.searchAvailableParts(req.valid.query));
  } catch (error) {
    next(error);
  }
}

export async function alerts(req, res, next) {
  try {
    ok(res, await inventoryService.getAlerts());
  } catch (error) {
    next(error);
  }
}
