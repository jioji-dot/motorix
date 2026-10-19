import { clientService } from '../services/clientService.js';

export async function list(req, res) {
  const { items, meta } = await clientService.list(req.valid.query);
  res.json({ data: items, meta });
}

export async function get(req, res) {
  res.json({ data: await clientService.get(req.valid.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await clientService.create(req.valid.body) });
}

export async function update(req, res) {
  res.json({ data: await clientService.update(req.valid.params.id, req.valid.body) });
}
