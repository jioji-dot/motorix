import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createTicketService } from '../../services/ticketService.js';

const conexion = { id: 'conexion' };
const config = { jwt: { secret: 'secreto-de-sesion' }, workshop: { name: 'T', address: 'D', phone: 'P' } };
const RECEPCION = { id: 2, role: 'RECEPTIONIST' };

function crearEntorno({ orden = { id: 9, folio: 'OS-000009', status: 'TERMINADO', total: '100.00', entryMileage: 1, serviceMileage: null, clientName: 'C', clientPhone: '5', brand: 'A', model: 'B', year: 2020, licensePlate: 'X' }, existente = null } = {}) {
  let ticket = existente;
  const ticketModel = {
    findOrderData: jest.fn(async () => orden),
    findLines: jest.fn(async () => ({ services: [], labor: [], parts: [], payments: [] })),
    findByOrder: jest.fn(async () => ticket),
    lastPaidPaymentId: jest.fn(async () => 77),
    create: jest.fn(async () => { ticket = { id: 5, folio: 'TK-000005', orderId: 9, paymentId: 77, generatedAt: '2026-10-19T00:00:00.000Z' }; return 5; }),
    setPayment: jest.fn(async () => {}),
    lockOrder: jest.fn(async () => {}),
  };
  const servicio = createTicketService({ ticketModel, config, transaction: async (trabajo) => trabajo(conexion) });
  return { servicio, ticketModel };
}

describe('Ticket: generación', () => {
  test('crea_el_ticket_de_una_orden_terminada_con_su_pago_principal', async () => {
    const { servicio, ticketModel } = crearEntorno();
    const { ticket, created } = await servicio.generate(9, RECEPCION);
    expect(created).toBe(true);
    expect(ticketModel.create).toHaveBeenCalledWith(conexion, { orderId: 9, paymentId: 77, generatedBy: 2 });
    expect(ticket.folio).toBe('TK-000005');
  });

  test('generar_de_nuevo_devuelve_el_mismo_ticket_y_actualiza_el_pago_principal', async () => {
    const existente = { id: 5, folio: 'TK-000005', orderId: 9, paymentId: 1, generatedAt: '2026-10-19T00:00:00.000Z' };
    const { servicio, ticketModel } = crearEntorno({ existente });
    const { ticket, created } = await servicio.generate(9, RECEPCION);
    expect(created).toBe(false);
    expect(ticketModel.create).not.toHaveBeenCalled();
    expect(ticketModel.setPayment).toHaveBeenCalledWith(conexion, 5, 77);
    expect(ticket.folio).toBe('TK-000005');
  });

  test('dos_generaciones_simultaneas_devuelven_el_ticket_del_ganador', async () => {
    const { servicio, ticketModel } = crearEntorno();
    ticketModel.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    ticketModel.findByOrder.mockResolvedValueOnce(null).mockResolvedValue({ id: 8, folio: 'TK-000008', orderId: 9, generatedAt: '2026-10-19T00:00:00.000Z' });
    const { ticket, created } = await servicio.generate(9, RECEPCION);
    expect(created).toBe(false);
    expect(ticket.folio).toBe('TK-000008');
  });

  test('solo_las_ordenes_terminadas_o_entregadas_tienen_ticket', async () => {
    for (const status of ['RECIBIDO', 'EN_REPARACION', 'CANCELADA']) {
      const { servicio, ticketModel } = crearEntorno({ orden: { id: 9, status, total: '1.00' } });
      await expect(servicio.generate(9, RECEPCION)).rejects.toMatchObject({ status: 409, code: 'TICKET_NOT_AVAILABLE' });
      expect(ticketModel.create).not.toHaveBeenCalled();
    }
  });

  test('una_orden_inexistente_o_sin_ticket_responde_404', async () => {
    await expect(crearEntorno({ orden: null }).servicio.generate(9, RECEPCION)).rejects.toMatchObject({ status: 404 });
    await expect(crearEntorno().servicio.get(9)).rejects.toMatchObject({ status: 404 });
  });
});

describe('Ticket: token de impresión', () => {
  const existente = { id: 5, folio: 'TK-000005', orderId: 9, paymentId: null, generatedAt: '2026-10-19T00:00:00.000Z' };

  test('emite_un_token_de_5_minutos_que_da_acceso_al_ticket_de_esa_orden', async () => {
    const { servicio } = crearEntorno({ existente });
    const { token, expiresInSeconds } = await servicio.createPrintToken(9);
    expect(expiresInSeconds).toBe(300);
    const contenido = await servicio.contentForPrintToken(token);
    expect(contenido.folio).toBe('TK-000005');
  });

  test('no_se_puede_emitir_sin_ticket', async () => {
    await expect(crearEntorno().servicio.createPrintToken(9)).rejects.toMatchObject({ status: 404 });
  });

  test('un_token_de_impresion_no_autentica_como_sesion', async () => {
    const { servicio } = crearEntorno({ existente });
    const { token } = await servicio.createPrintToken(9);
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });

  test('un_token_de_sesion_no_abre_la_impresion', async () => {
    const { servicio } = crearEntorno({ existente });
    const sesion = jwt.sign({ sub: 1 }, config.jwt.secret, { expiresIn: '1h' });
    await expect(servicio.contentForPrintToken(sesion)).rejects.toMatchObject({ status: 401 });
  });

  test('rechaza_tokens_vencidos_alterados_o_de_otro_tipo', async () => {
    const { servicio } = crearEntorno({ existente });
    const clave = `${config.jwt.secret}:ticket-print`;
    const vencido = jwt.sign({ ord: 9, typ: 'ticket-print' }, clave, { expiresIn: -10 });
    const otroTipo = jwt.sign({ ord: 9, typ: 'otro' }, clave, { expiresIn: 60 });
    const sinOrden = jwt.sign({ typ: 'ticket-print' }, clave, { expiresIn: 60 });
    const { token } = await servicio.createPrintToken(9);
    for (const malo of [vencido, otroTipo, sinOrden, `${token}x`, 'basura']) {
      await expect(servicio.contentForPrintToken(malo)).rejects.toMatchObject({ status: 401 });
    }
  });

  test('el_token_solo_sirve_para_la_orden_para_la_que_se_emitio', async () => {
    const { servicio, ticketModel } = crearEntorno({ existente });
    const { token } = await servicio.createPrintToken(9);
    await servicio.contentForPrintToken(token);
    expect(ticketModel.findOrderData).toHaveBeenLastCalledWith(9);
  });
});
