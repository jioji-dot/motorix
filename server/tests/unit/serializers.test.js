import { serializeHistoryItem, serializeOrder, serializeOrderListItem, serializePart } from '../../services/serializers.js';

const parte = { id: 1, code: 'R-1', salePrice: '120.00', purchasePrice: '80.00' };

describe('Serializador de refacciones por rol', () => {
  test('el_administrador_ve_el_precio_de_compra_y_el_de_venta', () => {
    const visible = serializePart(parte, { role: 'ADMIN' });
    expect(visible.purchasePrice).toBe('80.00');
    expect(visible.salePrice).toBe('120.00');
  });

  test('recepcion_no_recibe_purchasePrice_pero_si_el_precio_de_venta', () => {
    const visible = serializePart(parte, { role: 'RECEPTIONIST' });
    expect(visible).not.toHaveProperty('purchasePrice');
    expect(visible.salePrice).toBe('120.00');
  });

  test('el_mecanico_no_recibe_ni_purchasePrice_ni_salePrice_y_conserva_el_resto', () => {
    const visible = serializePart(parte, { role: 'MECHANIC' });
    expect(visible).not.toHaveProperty('purchasePrice');
    expect(visible).not.toHaveProperty('salePrice');
    expect(visible).toMatchObject({ id: 1, code: 'R-1' });
  });

  test('sin_usuario_tampoco_se_envia_el_precio_de_compra_y_no_modifica_el_original', () => {
    expect(serializePart(parte, undefined)).not.toHaveProperty('purchasePrice');
    expect(parte.purchasePrice).toBe('80.00');
    expect(parte.salePrice).toBe('120.00');
  });
});

const orden = () => ({
  id: 7,
  folio: 'OS-000007',
  total: '1250.00',
  services: [{ id: 1, description: 'Afinación', amount: '500.00' }],
  labor: [{ id: 2, description: 'Mano de obra', hours: '2.00', hourlyRate: '100.00', amount: '200.00' }],
  parts: [{ id: 3, partId: 9, code: 'R-9', name: 'Filtro', quantity: 5, unitPrice: '110.00', amount: '550.00' }],
});

describe('Serializador de órdenes por rol (Sprint 5, FR-008)', () => {
  test('administrador_y_recepcion_reciben_la_orden_completa_con_total_e_importes', () => {
    for (const role of ['ADMIN', 'RECEPTIONIST']) {
      expect(serializeOrder(orden(), { role })).toEqual(orden());
    }
  });

  test('el_mecanico_no_recibe_total_ni_precio_unitario_ni_importe_de_las_lineas_de_refaccion', () => {
    const visible = serializeOrder(orden(), { role: 'MECHANIC' });
    expect(visible).not.toHaveProperty('total');
    expect(visible.parts).toEqual([{ id: 3, partId: 9, code: 'R-9', name: 'Filtro', quantity: 5 }]);
  });

  test('el_mecanico_conserva_los_importes_de_servicios_y_mano_de_obra', () => {
    const visible = serializeOrder(orden(), { role: 'MECHANIC' });
    expect(visible.services).toEqual(orden().services);
    expect(visible.labor).toEqual(orden().labor);
    expect(visible.folio).toBe('OS-000007');
  });

  test('el_listado_y_el_historial_aplican_la_misma_regla', () => {
    const resumen = { id: 7, folio: 'OS-000007', total: '1250.00', status: 'TERMINADO' };
    expect(serializeOrderListItem(resumen, { role: 'MECHANIC' })).toEqual({ id: 7, folio: 'OS-000007', status: 'TERMINADO' });
    expect(serializeOrderListItem(resumen, { role: 'RECEPTIONIST' })).toEqual(resumen);
    const entrada = { orderId: 7, total: '1250.00', parts: orden().parts, services: orden().services };
    const visible = serializeHistoryItem(entrada, { role: 'MECHANIC' });
    expect(visible).not.toHaveProperty('total');
    expect(visible.parts[0]).not.toHaveProperty('unitPrice');
    expect(visible.parts[0]).not.toHaveProperty('amount');
    expect(visible.services).toEqual(orden().services);
  });

  test('no_modifica_el_original_ni_falla_con_una_orden_sin_lineas_de_refaccion', () => {
    const original = orden();
    serializeOrder(original, { role: 'MECHANIC' });
    expect(original).toEqual(orden());
    expect(serializeOrder({ id: 1, total: '0.00' }, { role: 'MECHANIC' })).toEqual({ id: 1 });
    expect(serializeOrder(null, { role: 'MECHANIC' })).toBeNull();
  });
});
