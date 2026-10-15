import * as authService from '../services/authService.js';
import { noContent, ok } from '../utils/response.js';

export async function login(req, res, next) {
  try {
    const resultado = await authService.login(req.valid.body);
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  ok(res, authService.getProfile(req.user));
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user, req.valid.body);
    noContent(res);
  } catch (error) {
    next(error);
  }
}
