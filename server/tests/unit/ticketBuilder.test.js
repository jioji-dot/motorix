// Pruebas unitarias de buildTicket (función pura): arma el comprobante a partir de los datos de la orden.
import { buildTicket } from '../../utils/ticketBuilder.js';
import { DEFAULT_WORKSHOP } from '../../config/constants.js';

const taller = { name: 'Taller Prueba', address: 'Calle 1', phone: '5550001111' };

const entrada = (cambios = {}) => ({
  ticket: { id: 3, folio: 'TK-000003', createdAt: new Date('2026-10-14T16:25:00.000Z'), generatedByName: 'Rosa Recepción' },
  order: {
    id: 7,
    folio: 'OS-000007',
    status: 'ENTREGADO',
    entryMileage: 47000,
    serviceMileage: 47150,
    createdAt: new Date('2026-10-12T12:00:00.000Z'),
    deliveredAt: new Date('2026-10-14T15:00:00.000Z')
  },
  client: { name: 'Ana Pérez', phone: '5511223344' },
  vehicle: { brand: 'Nissan', model: 'Versa', licensePlate: 'PRD482A' },
  services: [{ id: 1, description: 'Afinación', amount: 450 }],
  labor: [{ id: 1, description: 'Cambio de bujías', hours: 2.5, hourlyRate: 350, amount: 875 }],
  parts: [{ id: 1, partId: 9, code: 'BUJ-NGK', name: 'Bujía de iridio', quantity: 4, unitPrice: 95, amount: 380 }],
  payments: [],
  workshop: taller,
  ...cambios
});

const pago = (cambios = {}) => ({
  id: 1,
  method: 'CASH',
  amount: 500,
  status: 'APROBADO',
  reference: null,
  createdAt: new Date('2026-10-14T14:00:00.000Z'),
  ...cambios
});

describe('buildTicket', () => {
  test('test_incluye_folios_taller_cliente_vehiculo_y_kilometrajes', () => {
    const t = buildTicket(entrada());

    expect(t.id).toBe(3);
    expect(t.folio).toBe('TK-000003');
    expect(t.issuedAt).toEqual(new Date('2026-10-14T16:25:00.000Z'));
    expect(t.generatedByName).toBe('Rosa Recepción');
    expect(t.workshop).toEqual(taller);
    expect(t.order).toEqual({
      id: 7,
      folio: 'OS-000007',
      status: 'ENTREGADO',
      createdAt: new Date('2026-10-12T12:00:00.000Z'),
      deliveredAt: new Date('2026-10-14T15:00:00.000Z')
    });
    expect(t.client).toEqual({ name: 'Ana Pérez', phone: '5511223344' });
    expect(t.vehicle).toEqual({
      brand: 'Nissan',
      model: 'Versa',
      licensePlate: 'PRD482A',
      entryMileage: 47000,
      serviceMileage: 47150
    });
  });

  test('test_lista_servicios_mano_de_obra_y_refacciones_con_importes_y_subtotales', () => {
    const t = buildTicket(entrada());

    expect(t.services).toEqual([{ description: 'Afinación', amount: 450 }]);
    expect(t.labor).toEqual([{ description: 'Cambio de bujías', hours: 2.5, hourlyRate: 350, amount: 875 }]);
    expect(t.parts).toEqual([
      { code: 'BUJ-NGK', name: 'Bujía de iridio', quantity: 4, unitPrice: 95, amount: 380 }
    ]);
    expect(t.subtotals).toEqual({ services: 450, labor: 875, parts: 380 });
    expect(t.total).toBe(1705);
  });

  test('test_las_sumas_coinciden_al_centavo_con_importes_decimales', () => {
    const t = buildTicket(
      entrada({
        services: [
          { id: 1, description: 'A', amount: 0.1 },
          { id: 2, description: 'B', amount: 0.2 }
        ],
        labor: [],
        parts: [{ id: 1, partId: 1, code: 'X', name: 'Y', quantity: 3, unitPrice: 33.33, amount: 99.99 }]
      })
    );

    expect(t.subtotals).toEqual({ services: 0.3, labor: 0, parts: 99.99 });
    expect(t.total).toBe(100.29);
  });

  test('test_solo_lista_pagos_aprobados_y_pendientes_en_orden_cronologico', () => {
    const t = buildTicket(
      entrada({
        payments: [
          pago({ id: 4, status: 'ANULADO', amount: 100, createdAt: new Date('2026-10-14T13:00:00.000Z') }),
          pago({ id: 3, status: 'PENDIENTE', method: 'MERCADO_PAGO', amount: 200, createdAt: new Date('2026-10-14T15:00:00.000Z') }),
          pago({ id: 2, status: 'RECHAZADO', amount: 50 }),
          pago({ id: 1, status: 'APROBADO', method: 'CARD', amount: 500, reference: 'AUT-4521' }),
          pago({ id: 5, status: 'CANCELADO', amount: 25 })
        ]
      })
    );

    expect(t.payments).toEqual([
      { method: 'CARD', amount: 500, status: 'APROBADO', reference: 'AUT-4521', createdAt: new Date('2026-10-14T14:00:00.000Z') },
      { method: 'MERCADO_PAGO', amount: 200, status: 'PENDIENTE', reference: null, createdAt: new Date('2026-10-14T15:00:00.000Z') }
    ]);
  });

  test('test_el_resumen_refleja_pagado_pendiente_saldo_y_estado', () => {
    const t = buildTicket(
      entrada({
        payments: [pago({ amount: 705 }), pago({ id: 2, status: 'PENDIENTE', method: 'MERCADO_PAGO', amount: 300 })]
      })
    );

    expect(t.summary).toEqual({
      total: 1705,
      paid: 705,
      pending: 300,
      balance: 1000,
      available: 700,
      status: 'PARTIAL'
    });
  });

  test('test_un_pago_anulado_cancelado_o_rechazado_no_altera_el_total_ni_el_saldo', () => {
    const base = buildTicket(entrada());
    const conInactivos = buildTicket(
      entrada({
        payments: [
          pago({ id: 1, status: 'ANULADO', amount: 1705 }),
          pago({ id: 2, status: 'CANCELADO', amount: 100 }),
          pago({ id: 3, status: 'RECHAZADO', amount: 100 })
        ]
      })
    );

    expect(conInactivos.total).toBe(base.total);
    expect(conInactivos.summary).toEqual(base.summary);
    expect(conInactivos.summary.status).toBe('UNPAID');
    expect(conInactivos.payments).toEqual([]);
  });

  test('test_orden_pagada_por_completo_queda_en_estado_pagada_con_saldo_cero', () => {
    const t = buildTicket(entrada({ payments: [pago({ amount: 1705 })] }));

    expect(t.summary).toEqual({ total: 1705, paid: 1705, pending: 0, balance: 0, available: 0, status: 'PAID' });
  });

  test('test_usa_los_datos_predeterminados_del_taller_cuando_faltan', () => {
    const t = buildTicket(entrada({ workshop: undefined }));

    expect(t.workshop).toEqual(DEFAULT_WORKSHOP);
  });

  test('test_el_kilometraje_de_servicio_y_la_entrega_pueden_faltar', () => {
    const t = buildTicket(
      entrada({
        order: { id: 7, folio: 'OS-000007', status: 'TERMINADO', entryMileage: 10, serviceMileage: null, createdAt: null, deliveredAt: null }
      })
    );

    expect(t.vehicle.serviceMileage).toBeNull();
    expect(t.order.deliveredAt).toBeNull();
  });
});
