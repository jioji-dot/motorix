import { settingsService } from '../services/settingsService.js';

export async function get(_req, res) {
  res.json({ data: await settingsService.get() });
}

export async function update(req, res) {
  res.json({ data: await settingsService.update(req.valid.body, req.user) });
}
