import { orderService } from '../services/orderService.js';

export async function create(req, res) {
  res.status(201).json({ data: await orderService.create(req.valid.body, req.user) });
}

export async function list(req, res) {
  const { items, meta } = await orderService.list(req.valid.query, req.user);
  res.json({ data: items, meta });
}

export async function get(req, res) {
  res.json({ data: await orderService.get(req.valid.params.id, req.user) });
}
