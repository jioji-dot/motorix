// Modelos nuevos del Sprint 7 contra la base de pruebas (FR-005, FR-018, FR-020, FR-024).
import * as auditModel from '../../models/auditModel.js';
import * as serviceTypeModel from '../../models/serviceTypeModel.js';
import * as settingsModel from '../../models/settingsModel.js';
import * as termsModel from '../../models/termsModel.js';
import { cerrarConexiones, crearUsuariosDePrueba, limpiarBase } from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

describe('settingsModel', () => {
  test('sin_filas_devuelve_un_objeto_vacio', async () => {
    expect(await settingsModel.getAll()).toEqual({});
  });

  test('guarda_varios_valores_y_actualiza_los_existentes', async () => {
    await settingsModel.saveMany({ 'workshop.name': 'Taller Uno', 'maintenance.warnDays': '20' }, usuarios.ADMIN.id);
    await settingsModel.saveMany({ 'workshop.name': 'Taller Dos' }, usuarios.ADMIN.id);
    expect(await settingsModel.getAll()).toEqual({ 'workshop.name': 'Taller Dos', 'maintenance.warnDays': '20' });
  });
});

describe('serviceTypeModel', () => {
  test('crea_lista_y_desactiva_sin_borrar', async () => {
    const id = await serviceTypeModel.create({ name: 'Cambio de aceite', intervalDays: 180, intervalKm: 5000 });
    const otro = await serviceTypeModel.create({ name: 'Frenos', intervalDays: null, intervalKm: 20000 });
    await serviceTypeModel.update(otro, { active: false });
    expect((await serviceTypeModel.list({ onlyActive: false })).map((t) => t.name)).toEqual(['Cambio de aceite', 'Frenos']);
    expect((await serviceTypeModel.list({ onlyActive: true })).map((t) => t.id)).toEqual([id]);
    expect(await serviceTypeModel.findById(otro)).toMatchObject({ active: false, intervalDays: null, intervalKm: 20000 });
  });

  test('el_nombre_repetido_no_distingue_mayusculas_ni_acentos', async () => {
    await expect(serviceTypeModel.create({ name: 'CAMBIO DE ACEITE', intervalDays: 1, intervalKm: null })).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    await expect(serviceTypeModel.create({ name: 'Cámbio de aceite', intervalDays: 1, intervalKm: null })).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  test('exige_al_menos_un_intervalo', async () => {
    await expect(serviceTypeModel.create({ name: 'Sin intervalo', intervalDays: null, intervalKm: null })).rejects.toBeDefined();
  });
});

describe('termsModel', () => {
  test('sin_versiones_no_hay_vigente', async () => {
    expect(await termsModel.current()).toBeNull();
  });

  test('publicar_asigna_numeros_consecutivos_y_la_vigente_es_la_mayor', async () => {
    const v1 = await termsModel.publish({ termsText: 'T1', privacyText: 'P1', userId: usuarios.ADMIN.id });
    const v2 = await termsModel.publish({ termsText: 'T2', privacyText: 'P2', userId: usuarios.ADMIN.id });
    expect(v2).toBe(v1 + 1);
    expect(await termsModel.current()).toMatchObject({ version: v2, termsText: 'T2', privacyText: 'P2' });
  });

  test('aceptar_dos_veces_no_duplica_y_separa_aceptados_y_pendientes', async () => {
    const { version } = await termsModel.current();
    await termsModel.accept(usuarios.RECEPTIONIST.id, version);
    await termsModel.accept(usuarios.RECEPTIONIST.id, version);
    expect(await termsModel.hasAccepted(usuarios.RECEPTIONIST.id, version)).toBe(true);
    expect(await termsModel.hasAccepted(usuarios.MECHANIC.id, version)).toBe(false);
    const { accepted, pending } = await termsModel.acceptances(version);
    expect(accepted.map((u) => u.userId)).toEqual([usuarios.RECEPTIONIST.id]);
    expect(pending.map((u) => u.userId).sort()).toEqual([usuarios.ADMIN.id, usuarios.MECHANIC.id].sort());
  });
});

describe('auditModel', () => {
  test('inserta_lista_filtra_y_pagina', async () => {
    await auditModel.insert(null, { userId: usuarios.ADMIN.id, action: 'SETTINGS_CHANGED', entity: 'settings', detail: { changes: [] } });
    await auditModel.insert(null, { userId: null, actorLabel: 'intruso', action: 'LOGIN_FAILED', entity: 'user' });
    await auditModel.insert(null, { userId: usuarios.ADMIN.id, action: 'USER_CREATED', entity: 'user', entityId: 9 });

    const todas = await auditModel.list({ page: 1, pageSize: 2 });
    expect(todas.total).toBe(3);
    expect(todas.items).toHaveLength(2);
    expect(todas.items[0].action).toBe('USER_CREATED'); // la más reciente primero
    expect((await auditModel.list({ action: 'LOGIN_FAILED', page: 1, pageSize: 10 })).items[0]).toMatchObject({ actorLabel: 'intruso', user: null });
    expect((await auditModel.list({ userId: usuarios.ADMIN.id, page: 1, pageSize: 10 })).total).toBe(2);
    const hoy = new Date().toISOString().slice(0, 10);
    expect((await auditModel.list({ from: hoy, to: hoy, page: 1, pageSize: 10 })).total).toBe(3);
    expect((await auditModel.list({ from: '2000-01-01', to: '2000-01-02', page: 1, pageSize: 10 })).total).toBe(0);
  });

  test('no_expone_funciones_de_edicion_ni_de_borrado', () => {
    expect(Object.keys(auditModel).sort()).toEqual(['insert', 'list']);
  });
});
