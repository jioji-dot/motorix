import { notificationService } from '../services/notificationService.js';

export async function get(req, res) {
  const { limitPerType, ...data } = await notificationService.get(req.user);
  res.json({ data, meta: { limitPerType } });
}

export async function markRead(req, res) {
  res.json({ data: await notificationService.markRead(req.user, req.valid.body.key) });
}
