// La bitácora solo guarda la lista cerrada de campos de cada acción (Sprint 7, FR-024, FR-026).
import { jest } from '@jest/globals';
import { createAuditService } from '../../services/auditService.js';

function crear() {
  const insert = jest.fn(async () => {});
  const list = jest.fn(async () => ({ items: [], total: 0 }));
  return { insert, servicio: createAuditService({ auditModel: { insert, list } }) };
}
const guardado = (insert) => insert.mock.calls[0][1];

describe('auditService.record', () => {
  test('descarta_contrasenas_hashes_tokens_y_cualquier_campo_extra', async () => {
    const { insert, servicio } = crear();
    await servicio.record('USER_ROLE_CHANGED', {
      userId: 1, entityId: 7,
      detail: { from: 'MECHANIC', to: 'ADMIN', password: 'Secreta1', passwordHash: 'x', token: 't', cardNumber: '4111', extra: 1 },
    });
    expect(guardado(insert)).toMatchObject({ action: 'USER_ROLE_CHANGED', entity: 'user', entityId: 7, detail: { from: 'MECHANIC', to: 'ADMIN' } });
    expect(JSON.stringify(guardado(insert))).not.toMatch(/Secreta1|passwordHash|"token"|cardNumber|4111/);
  });

  test('un_inicio_de_sesion_fallido_guarda_el_identificador_y_nunca_la_contrasena', async () => {
    const { insert, servicio } = crear();
    await servicio.record('LOGIN_FAILED', { actorLabel: 'x'.repeat(300), detail: { password: 'Secreta1' } });
    const e = guardado(insert);
    expect(e.actorLabel).toHaveLength(120);
    expect(e.detail).toBeNull();
    expect(JSON.stringify(e)).not.toContain('Secreta1');
  });

  test('los_cambios_de_configuracion_solo_conservan_clave_anterior_y_nueva', async () => {
    const { insert, servicio } = crear();
    await servicio.record('SETTINGS_CHANGED', { userId: 1, detail: { changes: [{ key: 'workshop.name', from: 'A', to: 'B', secreto: 'x' }] } });
    expect(guardado(insert).detail).toEqual({ changes: [{ key: 'workshop.name', from: 'A', to: 'B' }] });
  });

  test('pago_cancelado_conserva_solo_orden_e_importe', async () => {
    const { insert, servicio } = crear();
    await servicio.record('PAYMENT_CANCELLED', { userId: 1, entityId: 3, detail: { orderId: 5, amount: '100.00', cardNumber: '4111' } });
    expect(guardado(insert)).toMatchObject({ entity: 'payment', detail: { orderId: 5, amount: '100.00' } });
  });

  test('una_accion_desconocida_lanza_un_error', async () => {
    const { servicio } = crear();
    await expect(servicio.record('OTRA', {})).rejects.toThrow();
  });
});
