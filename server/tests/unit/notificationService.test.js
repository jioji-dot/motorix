// Servicio de avisos con modelos simulados: agrupa, cuenta, ordena, limita y descarta lecturas (Sprint 6, FR-001 a FR-003, FR-008, FR-009).
import { jest } from '@jest/globals';
import { createNotificationService } from '../../services/notificationService.js';

const admin = { id: 1, role: 'ADMIN' };
const mecanico = { id: 3, role: 'MECHANIC' };

const orden = (id, horas, extra = {}) => ({
  id, folio: `OS-${String(id).padStart(6, '0')}`, status: 'EN_REPARACION', licensePlate: `PL-${id}`, clientId: 1, vehicleId: 1,
  mechanicId: 3, clientName: 'Cliente', brand: 'Nissan', model: 'Versa', hours: horas, ...extra,
});

function crear({ ordenes = [], lecturas = [], citas = [], refacciones = [], mantenimientos = [] } = {}) {
  const modeloLecturas = {
    listReads: jest.fn(async () => lecturas),
    saveRead: jest.fn(async () => {}),
    deleteReads: jest.fn(async () => {}),
  };
  const servicio = createNotificationService({
    orderModel: { listStalled: jest.fn(async () => ordenes) },
    appointmentModel: { listByDay: jest.fn(async () => citas) },
    partModel: { listAlerts: jest.fn(async () => refacciones) },
    maintenanceService: { listAllClassified: jest.fn(async () => mantenimientos) },
    notificationModel: modeloLecturas,
    clientNoticeService: { countPending: jest.fn(async () => 0) },
    hoy: () => '2026-11-24',
  });
  return { servicio, modeloLecturas };
}

describe('notificationService.get', () => {
  test('sin_avisos_devuelve_una_respuesta_vacia', async () => {
    const { servicio } = crear();
    const r = await servicio.get(admin);
    expect(r).toMatchObject({ unread: 0, total: 0, groups: [], limitPerType: 10 });
  });

  test('agrupa_por_tipo_cuenta_y_ordena_las_ordenes_de_mas_a_menos_dias', async () => {
    const { servicio } = crear({ ordenes: [orden(1, 80), orden(2, 240), orden(3, 100)] });
    const r = await servicio.get(admin);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({ type: 'ORDER_STALLED', total: 3, unread: 3 });
    expect(r.groups[0].items.map((i) => i.key)).toEqual(['ORDEN:2', 'ORDEN:3', 'ORDEN:1']);
    expect(r.groups[0].items[0].data).toMatchObject({ folio: 'OS-000002', daysStalled: 10, status: 'EN_REPARACION' });
    expect(r.groups[0].items[0].target).toEqual({ kind: 'order', id: 2 });
  });

  test('el_panel_muestra_10_por_tipo_pero_el_conteo_incluye_todos', async () => {
    const muchas = Array.from({ length: 14 }, (_, i) => orden(i + 1, 100 + i));
    const { servicio } = crear({ ordenes: muchas });
    const r = await servicio.get(admin);
    expect(r.groups[0].items).toHaveLength(10);
    expect(r.groups[0].total).toBe(14);
    expect(r.unread).toBe(14);
    expect(r.total).toBe(14);
  });

  test('marca_como_leidos_los_avisos_con_lectura_y_no_los_cuenta', async () => {
    const { servicio } = crear({ ordenes: [orden(1, 100), orden(2, 100)], lecturas: ['ORDEN:1'] });
    const r = await servicio.get(admin);
    expect(r.unread).toBe(1);
    expect(r.total).toBe(2);
    expect(r.groups[0].items.find((i) => i.key === 'ORDEN:1').read).toBe(true);
  });

  test('descarta_las_lecturas_de_avisos_que_ya_no_existen', async () => {
    const { servicio, modeloLecturas } = crear({ ordenes: [orden(1, 100)], lecturas: ['ORDEN:1', 'ORDEN:99', 'STOCK:5:AGOTADO'] });
    await servicio.get(admin);
    expect(modeloLecturas.deleteReads).toHaveBeenCalledWith(1, ['ORDEN:99', 'STOCK:5:AGOTADO']);
  });

  test('ningun_aviso_incluye_telefonos', async () => {
    const { servicio } = crear({ ordenes: [orden(1, 100, { clientPhone: '5512345678' })] });
    expect(JSON.stringify(await servicio.get(admin))).not.toMatch(/phone|5512345678/i);
  });

  test('el_mecanico_solo_consulta_ordenes_detenidas_suyas', async () => {
    const { servicio } = crear({ ordenes: [orden(1, 100)] });
    await servicio.get(mecanico);
    // el servicio de la prueba se creó con otra instancia; se comprueba aparte con un modelo observable
    const listStalled = jest.fn(async () => []);
    const listAlerts = jest.fn(async () => []);
    const listByDay = jest.fn(async () => []);
    const listAllClassified = jest.fn(async () => []);
    const s = createNotificationService({
      orderModel: { listStalled }, appointmentModel: { listByDay }, partModel: { listAlerts },
      maintenanceService: { listAllClassified },
      notificationModel: { listReads: async () => [], saveRead: async () => {}, deleteReads: async () => {} },
      clientNoticeService: { countPending: async () => 0 },
    });
    await s.get(mecanico);
    expect(listStalled).toHaveBeenCalledWith({ hours: 72, mechanicId: 3 });
    expect(listAlerts).not.toHaveBeenCalled();
    expect(listByDay).not.toHaveBeenCalled();
    expect(listAllClassified).not.toHaveBeenCalled();
  });
});

describe('notificationService.markRead', () => {
  test('guarda_la_lectura_si_el_aviso_es_visible', async () => {
    const { servicio, modeloLecturas } = crear({ ordenes: [orden(7, 100)] });
    expect(await servicio.markRead(admin, 'ORDEN:7')).toEqual({ key: 'ORDEN:7', read: true });
    expect(modeloLecturas.saveRead).toHaveBeenCalledWith(1, 'ORDEN:7');
  });

  test('un_tipo_ajeno_al_rol_se_rechaza_como_no_encontrado', async () => {
    const { servicio, modeloLecturas } = crear();
    await expect(servicio.markRead(mecanico, 'STOCK:5:AGOTADO')).rejects.toMatchObject({ status: 404 });
    expect(modeloLecturas.saveRead).not.toHaveBeenCalled();
  });

  test('un_aviso_que_ya_no_existe_o_es_ajeno_no_produce_efecto_ni_error', async () => {
    const { servicio, modeloLecturas } = crear({ ordenes: [] });
    expect(await servicio.markRead(mecanico, 'ORDEN:55')).toEqual({ key: 'ORDEN:55', read: false });
    expect(modeloLecturas.saveRead).not.toHaveBeenCalled();
  });

  test('una_clave_mal_formada_es_un_error_de_validacion', async () => {
    const { servicio } = crear();
    await expect(servicio.markRead(admin, 'cualquier cosa')).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });
});
