import * as historyService from '../services/historyService.js';
import { okList } from '../utils/response.js';

export async function getVehicleHistory(req, res, next) {
  try {
    const { items, total, page, pageSize } = await historyService.getVehicleHistory(
      req.valid.params.id,
      req.valid.query
    );
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}
