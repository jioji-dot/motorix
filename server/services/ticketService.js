// Generación y consulta de tickets de servicio, y token de impresión de corta vida.
import jwt from 'jsonwebtoken';
import { withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import * as modeloTickets from '../models/ticketModel.js';
import { BILLABLE_ORDER_STATUSES } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { hoyLocal } from './maintenanceClassifier.js';
import { settingsService as servicioConfiguracion } from './settingsService.js';
import { buildTicket } from './ticketBuilder.js';

export const VIGENCIA_TOKEN_SEGUNDOS = 300;

// Próximo servicio: la fecha más cercana (hoy más los días del intervalo) y el kilometraje menor (kilometraje más los km).
export function calcularProximoServicio(tipos, kilometraje, hoy = hoyLocal()) {
  const conDias = tipos.filter((t) => t.intervalDays);
  const conKm = tipos.filter((t) => t.intervalKm);
  if (conDias.length === 0 && conKm.length === 0) return null;
  const [anio, mes, dia] = hoy.split('-').map(Number);
  const fecha = (dias) => hoyLocal(new Date(anio, mes - 1, dia + dias));
  const masCercano = conDias.sort((a, b) => a.intervalDays - b.intervalDays)[0];
  const menorKm = conKm.sort((a, b) => a.intervalKm - b.intervalKm)[0];
  return {
    name: (masCercano ?? menorKm).name,
    date: masCercano ? fecha(masCercano.intervalDays) : null,
    mileage: menorKm ? kilometraje + menorKm.intervalKm : null,
  };
}

export function createTicketService({
  ticketModel = modeloTickets,
  transaction = withTransaction,
  config = env,
  settingsService = servicioConfiguracion,
} = {}) {
  // Clave distinta de la de sesión: un token de impresión no sirve como sesión y viceversa.
  const claveDeImpresion = `${config.jwt.secret}:ticket-print`;

  async function contenido(ticket) {
    const [order, lineas] = await Promise.all([ticketModel.findOrderData(ticket.orderId), ticketModel.findLines(ticket.orderId)]);
    // Los tickets generados antes del Sprint 7 no tienen instantánea: se arman con los datos vigentes.
    const workshop = ticket.shopName
      ? { name: ticket.shopName, address: ticket.shopAddress ?? '', phone: ticket.shopPhone ?? '' }
      : await settingsService.getWorkshop();
    const nextService = ticket.nextServiceName
      ? { name: ticket.nextServiceName, date: ticket.nextServiceDate ?? null, mileage: ticket.nextServiceMileage ?? null }
      : null;
    return buildTicket({ ticket, order, ...lineas, workshop, nextService });
  }

  async function exigirOrdenFacturable(orderId) {
    const orden = await ticketModel.findOrderData(orderId);
    if (!orden) throw HttpError.notFound('No se encontró la orden solicitada.');
    if (!BILLABLE_ORDER_STATUSES.includes(orden.status)) {
      throw new HttpError(409, 'TICKET_NOT_AVAILABLE', 'Solo las órdenes Terminadas o Entregadas tienen ticket.');
    }
    return orden;
  }

  // Genera el ticket de la orden o devuelve el que ya existe (actualizando su pago principal).
  async function generate(orderId, usuario) {
    const orden = await exigirOrdenFacturable(orderId);
    const workshop = await settingsService.getWorkshop();
    const tipos = await ticketModel.findServiceIntervals(orderId);
    const nextService = calcularProximoServicio(tipos, orden.serviceMileage ?? orden.entryMileage);
    let creado = false;
    const ticketId = await transaction(async (conexion) => {
      await ticketModel.lockOrder(conexion, orderId);
      const paymentId = await ticketModel.lastPaidPaymentId(orderId, conexion);
      let existente = await ticketModel.findByOrder(orderId, conexion);
      if (!existente) {
        try {
          const id = await ticketModel.create(conexion, { orderId, paymentId, generatedBy: usuario.id, workshop, nextService });
          creado = true;
          return id;
        } catch (error) {
          // Dos generaciones simultáneas: gana la primera y la otra devuelve ese mismo ticket.
          if (error?.code !== 'ER_DUP_ENTRY') throw error;
          existente = await ticketModel.findByOrder(orderId, conexion);
        }
      }
      await ticketModel.setPayment(conexion, existente.id, paymentId);
      return existente.id;
    });
    const ticket = await ticketModel.findByOrder(orderId);
    return { ticket: await contenido({ ...ticket, id: ticketId }), created: creado };
  }

  async function get(orderId) {
    const orden = await ticketModel.findOrderData(orderId);
    if (!orden) throw HttpError.notFound('No se encontró la orden solicitada.');
    const ticket = await ticketModel.findByOrder(orderId);
    if (!ticket) throw HttpError.notFound('Esta orden todavía no tiene ticket. Genera el ticket primero.');
    return contenido(ticket);
  }

  async function createPrintToken(orderId) {
    const ticket = await ticketModel.findByOrder(orderId);
    if (!ticket) throw HttpError.notFound('Esta orden todavía no tiene ticket. Genera el ticket primero.');
    const token = jwt.sign({ ord: orderId, typ: 'ticket-print' }, claveDeImpresion, { expiresIn: VIGENCIA_TOKEN_SEGUNDOS });
    return { token, expiresInSeconds: VIGENCIA_TOKEN_SEGUNDOS };
  }

  // Devuelve el contenido del ticket al que da acceso un token de impresión válido.
  async function contentForPrintToken(token) {
    let carga;
    try {
      carga = jwt.verify(token, claveDeImpresion);
    } catch {
      throw HttpError.unauthenticated('El enlace de impresión venció o no es válido. Genera uno nuevo desde Motorix.');
    }
    if (carga.typ !== 'ticket-print' || !Number.isInteger(carga.ord)) {
      throw HttpError.unauthenticated('El enlace de impresión no es válido.');
    }
    return get(carga.ord);
  }

  return { generate, get, createPrintToken, contentForPrintToken };
}

export const ticketService = createTicketService();
