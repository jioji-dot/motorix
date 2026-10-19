import { userService } from '../services/userService.js';

export async function list(req, res) {
  const { items, meta } = await userService.list(req.valid.query);
  res.json({ data: items, meta });
}

export async function get(req, res) {
  res.json({ data: await userService.get(req.valid.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await userService.create(req.valid.body) });
}

export async function update(req, res) {
  res.json({ data: await userService.update(req.valid.params.id, req.valid.body) });
}
