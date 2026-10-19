import { serializePart } from '../../services/serializers.js';

const parte = { id: 1, code: 'R-1', salePrice: '120.00', purchasePrice: '80.00' };

describe('Serializador de refacciones por rol', () => {
  test('el_administrador_ve_el_precio_de_compra', () => {
    expect(serializePart(parte, { role: 'ADMIN' }).purchasePrice).toBe('80.00');
  });

  test('mecanico_y_recepcion_no_reciben_el_campo_purchasePrice', () => {
    for (const role of ['MECHANIC', 'RECEPTIONIST']) {
      const visible = serializePart(parte, { role });
      expect(visible).not.toHaveProperty('purchasePrice');
      expect(visible.salePrice).toBe('120.00');
    }
  });

  test('sin_usuario_tampoco_se_envia_el_precio_de_compra_y_no_modifica_el_original', () => {
    expect(serializePart(parte, undefined)).not.toHaveProperty('purchasePrice');
    expect(parte.purchasePrice).toBe('80.00');
  });
});
