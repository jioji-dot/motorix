import { maintenanceService } from '../services/maintenanceService.js';

export async function create(req, res) {
  res.status(201).json({ data: await maintenanceService.create(req.valid.body, req.user) });
}

export async function list(req, res) {
  const { items, meta } = await maintenanceService.list(req.valid.query);
  res.json({ data: items, meta });
}

export async function get(req, res) {
  res.json({ data: await maintenanceService.get(req.valid.params.id) });
}

export async function update(req, res) {
  res.json({ data: await maintenanceService.update(req.valid.params.id, req.valid.body) });
}
