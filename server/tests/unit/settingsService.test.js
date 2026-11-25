// Reglas de la configuración: respaldos, límites y bitácora (Sprint 7, FR-001, FR-003, FR-004, FR-026).
import { jest } from '@jest/globals';
import { createSettingsService } from '../../services/settingsService.js';

function crear(guardados = {}) {
  const almacen = { ...guardados };
  const settingsModel = {
    getAll: jest.fn(async () => ({ ...almacen })),
    saveMany: jest.fn(async (pares) => Object.assign(almacen, pares)),
  };
  const record = jest.fn(async () => {});
  const servicio = createSettingsService({
    settingsModel,
    auditService: { record },
    config: { workshop: { name: 'Taller .env', address: 'Dirección .env', phone: '555' } },
  });
  return { servicio, settingsModel, record };
}
const admin = { id: 1, role: 'ADMIN' };

describe('lectura con respaldo', () => {
  test('sin_filas_usa_env_y_15_dias_500_km', async () => {
    const { servicio } = crear();
    expect(await servicio.get()).toEqual({
      workshop: { name: 'Taller .env', address: 'Dirección .env', phone: '555' },
      maintenance: { warnDays: 15, warnKm: 500 },
      defaults: { warnDays: 15, warnKm: 500 },
    });
    expect(await servicio.getMaintenanceMargins()).toEqual({ dias: 15, km: 500 });
  });

  test('los_valores_guardados_ganan_al_respaldo', async () => {
    const { servicio } = crear({ 'workshop.name': 'Mi taller', 'maintenance.warnDays': '30', 'maintenance.warnKm': '1000' });
    expect((await servicio.getWorkshop()).name).toBe('Mi taller');
    expect(await servicio.getMaintenanceMargins()).toEqual({ dias: 30, km: 1000 });
  });
});

describe('update', () => {
  test.each([[0], [366], [1.5], ['x']])('rechaza_dias_invalidos_%p', async (valor) => {
    const { servicio, settingsModel } = crear();
    await expect(servicio.update({ maintenance: { warnDays: valor } }, admin)).rejects.toMatchObject({ status: 400 });
    expect(settingsModel.saveMany).not.toHaveBeenCalled();
  });

  test.each([[0], [100001]])('rechaza_km_invalidos_%p', async (valor) => {
    const { servicio } = crear();
    await expect(servicio.update({ maintenance: { warnKm: valor } }, admin)).rejects.toMatchObject({ status: 400 });
  });

  test('acepta_los_limites', async () => {
    const { servicio } = crear();
    await servicio.update({ maintenance: { warnDays: 1, warnKm: 1 } }, admin);
    await servicio.update({ maintenance: { warnDays: 365, warnKm: 100000 } }, admin);
    expect(await servicio.getMaintenanceMargins()).toEqual({ dias: 365, km: 100000 });
  });

  test('valida_el_nombre_la_direccion_y_el_telefono', async () => {
    const { servicio } = crear();
    await expect(servicio.update({ workshop: { name: '   ' } }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(servicio.update({ workshop: { name: 'x'.repeat(121) } }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(servicio.update({ workshop: { address: 'x'.repeat(201) } }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(servicio.update({ workshop: { phone: 'x'.repeat(31) } }, admin)).rejects.toMatchObject({ status: 400 });
  });

  test('guarda_solo_lo_recibido_y_registra_solo_lo_que_cambio', async () => {
    const { servicio, settingsModel, record } = crear({ 'workshop.name': 'Viejo' });
    await servicio.update({ workshop: { name: 'Nuevo', phone: '777' } }, admin);
    expect(settingsModel.saveMany).toHaveBeenCalledWith({ 'workshop.name': 'Nuevo', 'workshop.phone': '777' }, 1);
    expect(record).toHaveBeenCalledWith('SETTINGS_CHANGED', {
      userId: 1,
      detail: { changes: [{ key: 'workshop.name', from: 'Viejo', to: 'Nuevo' }, { key: 'workshop.phone', from: '555', to: '777' }] },
    });
  });

  test('si_nada_cambia_no_registra_en_la_bitacora', async () => {
    const { servicio, record } = crear({ 'workshop.name': 'Igual' });
    await servicio.update({ workshop: { name: 'Igual' } }, admin);
    expect(record).not.toHaveBeenCalled();
  });
});
