import * as userService from '../services/userService.js';
import { noContent, ok, okList } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await userService.listUsers(req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await userService.createUser(req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await userService.getUserById(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await userService.updateUser(req.user, req.valid.params.id, req.valid.body));
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await userService.resetPassword(req.valid.params.id, req.valid.body.newPassword);
    noContent(res);
  } catch (error) {
    next(error);
  }
}
