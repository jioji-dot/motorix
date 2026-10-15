import * as dashboardService from '../services/dashboardService.js';
import { ok } from '../utils/response.js';

export async function get(req, res, next) {
  try {
    ok(res, await dashboardService.getDashboard());
  } catch (error) {
    next(error);
  }
}
