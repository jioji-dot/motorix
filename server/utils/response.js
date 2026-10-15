// Envoltorios de respuesta JSON consistentes (ver contracts/api.md).

export function ok(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function okList(res, data, { page, pageSize, total }) {
  return res.status(200).json({ data, meta: { page, pageSize, total } });
}

export function noContent(res) {
  return res.status(204).end();
}
