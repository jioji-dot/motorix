import { orderService } from '../services/orderService.js';

export async function create(req, res) {
  res.status(201).json({ data: await orderService.create(req.valid.body, req.user) });
}
