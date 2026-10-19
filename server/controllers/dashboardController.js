import { dashboardService } from '../services/dashboardService.js';

export async function get(_req, res) {
  res.json({ data: await dashboardService.get() });
}
