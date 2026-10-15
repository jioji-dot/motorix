import * as appointmentService from '../services/appointmentService.js';
import { ok, okList } from '../utils/response.js';

export async function list(req, res, next) {
  try {
    const { items, total, page, pageSize } = await appointmentService.listAppointments(req.valid.query);
    okList(res, items, { page, pageSize, total });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    ok(res, await appointmentService.createAppointment(req.user, req.valid.body), 201);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await appointmentService.updateAppointment(req.valid.params.id, req.valid.body));
  } catch (error) {
    next(error);
  }
}

export async function confirm(req, res, next) {
  try {
    ok(res, await appointmentService.confirmAppointment(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    ok(res, await appointmentService.cancelAppointment(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    ok(res, await appointmentService.getAppointment(req.valid.params.id));
  } catch (error) {
    next(error);
  }
}
