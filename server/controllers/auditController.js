import { auditService } from '../services/auditService.js';

export async function list(req, res) {
  const { page, pageSize } = req.valid.query;
  const { items, total } = await auditService.list(req.valid.query);
  res.json({ data: items, meta: { page, pageSize, total } });
}
