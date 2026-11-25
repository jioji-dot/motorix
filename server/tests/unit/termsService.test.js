// Reglas de los términos y condiciones con modelos simulados (Sprint 7, FR-018, FR-020, FR-022).
import { jest } from '@jest/globals';
import { createTermsService } from '../../services/termsService.js';

function crear({ vigente = null, aceptada = false } = {}) {
  const termsModel = {
    current: jest.fn(async () => vigente),
    hasAccepted: jest.fn(async () => aceptada),
    accept: jest.fn(async () => {}),
    publish: jest.fn(async () => (vigente?.version ?? 0) + 1),
    acceptances: jest.fn(async () => ({ accepted: [{ userId: 1, name: 'A', acceptedAt: 'x' }], pending: [{ userId: 2, name: 'B' }] })),
  };
  const record = jest.fn(async () => {});
  return { servicio: createTermsService({ termsModel, auditService: { record } }), termsModel, record };
}
const v2 = { version: 2, termsText: 'T', privacyText: 'P', publishedAt: '2026-11-25T00:00:00.000Z' };
const usuario = { id: 1, role: 'ADMIN' };

describe('getCurrent', () => {
  test('sin_version_publicada_devuelve_null', async () => {
    expect(await crear().servicio.getCurrent(usuario)).toBeNull();
  });
  test('con_version_indica_si_el_usuario_la_acepto', async () => {
    expect(await crear({ vigente: v2, aceptada: true }).servicio.getCurrent(usuario)).toMatchObject({ version: 2, accepted: true });
    expect((await crear({ vigente: v2 }).servicio.getCurrent(usuario)).accepted).toBe(false);
  });
});

describe('accept', () => {
  test('guarda_la_aceptacion_de_la_version_vigente', async () => {
    const { servicio, termsModel } = crear({ vigente: v2 });
    expect(await servicio.accept(usuario)).toMatchObject({ version: 2 });
    expect(termsModel.accept).toHaveBeenCalledWith(1, 2);
  });
  test('sin_version_publicada_responde_404', async () => {
    await expect(crear().servicio.accept(usuario)).rejects.toMatchObject({ status: 404 });
  });
});

describe('publish', () => {
  test('valida_que_los_textos_sean_obligatorios_y_de_hasta_20000_caracteres', async () => {
    const { servicio, termsModel } = crear();
    await expect(servicio.publish({ termsText: ' ', privacyText: 'P' }, usuario)).rejects.toMatchObject({ status: 400 });
    await expect(servicio.publish({ termsText: 'T', privacyText: 'x'.repeat(20001) }, usuario)).rejects.toMatchObject({ status: 400 });
    expect(termsModel.publish).not.toHaveBeenCalled();
  });
  test('publica_registra_la_bitacora_y_acepta_automaticamente_quien_publica', async () => {
    const { servicio, termsModel, record } = crear({ vigente: v2 });
    const r = await servicio.publish({ termsText: ' Nuevo ', privacyText: 'Priv' }, usuario);
    expect(termsModel.publish).toHaveBeenCalledWith({ termsText: 'Nuevo', privacyText: 'Priv', userId: 1 });
    expect(termsModel.accept).toHaveBeenCalledWith(1, 3);
    expect(record).toHaveBeenCalledWith('TERMS_PUBLISHED', { userId: 1, entityId: 3, detail: { version: 3 } });
    expect(r.version).toBe(3);
  });
});

describe('acceptances', () => {
  test('separa_aceptados_y_pendientes_de_la_version_vigente', async () => {
    const r = await crear({ vigente: v2 }).servicio.acceptances();
    expect(r).toMatchObject({ version: 2, accepted: [{ userId: 1 }], pending: [{ userId: 2 }] });
  });
  test('sin_version_devuelve_listas_vacias', async () => {
    expect(await crear().servicio.acceptances()).toEqual({ version: null, accepted: [], pending: [] });
  });
});
