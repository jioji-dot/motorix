import { appointmentService } from '../services/appointmentService.js';

export async function list(req, res) {
  const { items, meta } = await appointmentService.list(req.valid.query);
  res.json({ data: items, meta });
}

export async function get(req, res) {
  res.json({ data: await appointmentService.get(req.valid.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await appointmentService.create(req.valid.body, req.user) });
}

export async function update(req, res) {
  res.json({ data: await appointmentService.update(req.valid.params.id, req.valid.body) });
}

export async function confirm(req, res) {
  res.json({ data: await appointmentService.confirm(req.valid.params.id) });
}

export async function cancel(req, res) {
  res.json({ data: await appointmentService.cancel(req.valid.params.id) });
}
