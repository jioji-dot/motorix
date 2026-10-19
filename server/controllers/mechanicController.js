import * as userModel from '../models/userModel.js';

export async function list(_req, res) {
  res.json({ data: await userModel.listActiveMechanics() });
}
