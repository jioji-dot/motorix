import { partService } from '../services/partService.js';

export async function list(req, res) {
  const { items, meta } = await partService.list(req.valid.query, req.user);
  res.json({ data: items, meta });
}

export async function summary(_req, res) {
  res.json({ data: await partService.summary() });
}

export async function categories(_req, res) {
  res.json({ data: await partService.categories() });
}

export async function get(req, res) {
  res.json({ data: await partService.get(req.valid.params.id, req.user) });
}

export async function create(req, res) {
  res.status(201).json({ data: await partService.create(req.valid.body, req.user) });
}

export async function update(req, res) {
  res.json({ data: await partService.update(req.valid.params.id, req.valid.body, req.user) });
}

export async function registerMovement(req, res) {
  res.status(201).json({ data: await partService.registerMovement(req.valid.params.id, req.valid.body, req.user) });
}

export async function listMovements(req, res) {
  const { items, meta } = await partService.listMovements(req.valid.params.id, req.valid.query);
  res.json({ data: items, meta });
}
