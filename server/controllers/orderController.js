import { orderPartService } from '../services/orderPartService.js';
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

export async function update(req, res) {
  res.json({ data: await orderService.update(req.valid.params.id, req.valid.body, req.user) });
}

export async function addService(req, res) {
  res.status(201).json({ data: await orderService.addService(req.valid.params.id, req.valid.body, req.user) });
}

export async function updateService(req, res) {
  const { id, lineId } = req.valid.params;
  res.json({ data: await orderService.updateService(id, lineId, req.valid.body, req.user) });
}

export async function removeService(req, res) {
  const { id, lineId } = req.valid.params;
  res.json({ data: await orderService.removeService(id, lineId, req.user) });
}

export async function addLabor(req, res) {
  res.status(201).json({ data: await orderService.addLabor(req.valid.params.id, req.valid.body, req.user) });
}

export async function updateLabor(req, res) {
  const { id, lineId } = req.valid.params;
  res.json({ data: await orderService.updateLabor(id, lineId, req.valid.body, req.user) });
}

export async function removeLabor(req, res) {
  const { id, lineId } = req.valid.params;
  res.json({ data: await orderService.removeLabor(id, lineId, req.user) });
}

export async function changeStatus(req, res) {
  res.json({ data: await orderService.changeStatus(req.valid.params.id, req.valid.body, req.user) });
}

// Refacciones de la orden: tras cada cambio se devuelve la orden completa (con refacciones y total).
export async function addPart(req, res) {
  const { id } = req.valid.params;
  await orderPartService.add(id, req.valid.body, req.user);
  res.status(201).json({ data: await orderService.get(id, req.user) });
}

export async function updatePart(req, res) {
  const { id, lineId } = req.valid.params;
  await orderPartService.update(id, lineId, req.valid.body, req.user);
  res.json({ data: await orderService.get(id, req.user) });
}

export async function removePart(req, res) {
  const { id, lineId } = req.valid.params;
  await orderPartService.remove(id, lineId, req.user);
  res.json({ data: await orderService.get(id, req.user) });
}
