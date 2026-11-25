import { clientNoticeService } from '../services/clientNoticeService.js';

export async function list(req, res) {
  const { items, meta } = await clientNoticeService.list(req.valid.query);
  res.json({ data: items, meta });
}

export async function create(req, res) {
  const { created, notice } = await clientNoticeService.mark(req.user, req.valid.body);
  res.status(created ? 201 : 200).json({ data: notice });
}
