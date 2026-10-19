import { authService, datosPublicos } from '../services/authService.js';

export async function login(req, res) {
  const { identifier, password } = req.valid.body;
  const resultado = await authService.login(identifier, password);
  res.json({ data: resultado });
}

export function me(req, res) {
  res.json({ data: datosPublicos(req.user) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);
  res.status(204).end();
}
