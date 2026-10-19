import { vehicleService } from '../services/vehicleService.js';

export async function list(req, res) {
  const { items, meta } = await vehicleService.list(req.valid.query);
  res.json({ data: items, meta });
}

export async function get(req, res) {
  res.json({ data: await vehicleService.get(req.valid.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await vehicleService.create(req.valid.body) });
}

export async function update(req, res) {
  res.json({ data: await vehicleService.update(req.valid.params.id, req.valid.body) });
}
