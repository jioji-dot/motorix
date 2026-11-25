import { termsService } from '../services/termsService.js';

export async function current(req, res) {
  res.json({ data: await termsService.getCurrent(req.user) });
}

export async function accept(req, res) {
  res.json({ data: await termsService.accept(req.user) });
}

export async function publish(req, res) {
  res.status(201).json({ data: await termsService.publish(req.valid.body, req.user) });
}

export async function acceptances(_req, res) {
  res.json({ data: await termsService.acceptances() });
}
