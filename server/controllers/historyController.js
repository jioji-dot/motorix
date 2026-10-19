import { vehicleHistoryService } from '../services/vehicleHistoryService.js';

export async function vehicleHistory(req, res) {
  const { items, meta } = await vehicleHistoryService.list(req.valid.params.id, req.valid.query);
  res.json({ data: items, meta });
}
