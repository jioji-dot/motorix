import { serviceTypeService } from '../services/serviceTypeService.js';

export async function list(req, res) {
  res.json({ data: await serviceTypeService.list(req.user) });
}

export async function create(req, res) {
  res.status(201).json({ data: await serviceTypeService.create(req.valid.body, req.user) });
}

export async function update(req, res) {
  res.json({ data: await serviceTypeService.update(req.valid.params.id, req.valid.body, req.user) });
}
