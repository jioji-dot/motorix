// Consultas y modelos nuevos del Sprint 6 contra la base de pruebas: órdenes detenidas y listas para entregar, citas de un día,
// alertas de stock, mantenimientos clasificados, lecturas de avisos y avisos a clientes (FR-003, FR-005, FR-008, FR-017).
import { pool } from '../../config/db.js';
import * as modeloCitas from '../../models/appointmentModel.js';
import * as modeloAvisosClientes from '../../models/clientNoticeModel.js';
import * as modeloLecturas from '../../models/notificationModel.js';
import * as modeloOrdenes from '../../models/orderModel.js';
import * as modeloRefacciones from '../../models/partModel.js';
import { hoyLocal } from '../../services/maintenanceClassifier.js';
import { maintenanceService } from '../../services/maintenanceService.js';
import {
  cerrarConexiones,
  crearCita,
  crearClienteConVehiculo,
  crearMantenimiento,
  crearOrden,
  crearRefaccion,
  crearSegundoMecanico,
  crearUsuariosDePrueba,
  fechaDia,
  fechaLocal,
  limpiarBase,
} from '../helpers.js';

let usuarios;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
});
afterAll(cerrarConexiones);

const nuevaOrden = async (extra = {}) => {
  const { clientId, vehicleId } = await crearClienteConVehiculo();
  const id = await crearOrden({
    clientId, vehicleId, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, ...extra,
  });
  return { id, clientId, vehicleId };
};
const envejecer = (orderId, dias) =>
  pool.execute('UPDATE order_status_history SET changedAt = DATE_SUB(NOW(), INTERVAL ? DAY) WHERE orderId = ?', [dias, orderId]);

describe('orderModel.listStalled (órdenes detenidas)', () => {
  test('incluye_la_orden_abierta_con_72_horas_o_mas_desde_su_ultimo_cambio_de_estado', async () => {
    const vieja = await nuevaOrden();
    await envejecer(vieja.id, 5);
    const justa = await nuevaOrden();
    await pool.execute('UPDATE order_status_history SET changedAt = DATE_SUB(NOW(), INTERVAL 72 HOUR) WHERE orderId = ?', [justa.id]);
    const reciente = await nuevaOrden();
    await pool.execute('UPDATE order_status_history SET changedAt = DATE_SUB(NOW(), INTERVAL 71 HOUR) WHERE orderId = ?', [reciente.id]);

    const ids = (await modeloOrdenes.listStalled({ hours: 72 })).map((o) => o.id);
    expect(ids).toContain(vieja.id);
    expect(ids).toContain(justa.id);
    expect(ids).not.toContain(reciente.id);
  });

  test('devuelve_folio_placa_estado_y_horas_y_ordena_de_mas_a_menos_horas', async () => {
    const a = await nuevaOrden({ status: 'EN_REPARACION' });
    await envejecer(a.id, 4);
    const b = await nuevaOrden({ status: 'ESPERANDO_REFACCION' });
    await envejecer(b.id, 9);
    const lista = (await modeloOrdenes.listStalled({ hours: 72 })).filter((o) => [a.id, b.id].includes(o.id));
    expect(lista.map((o) => o.id)).toEqual([b.id, a.id]);
    expect(lista[0]).toMatchObject({ folio: `OS-${String(b.id).padStart(6, '0')}`, status: 'ESPERANDO_REFACCION' });
    expect(lista[0].licensePlate).toMatch(/^TST-/);
    expect(lista[0].hours).toBeGreaterThanOrEqual(9 * 24);
  });

  test('editar_una_nota_sin_cambiar_de_estado_no_reinicia_la_antiguedad', async () => {
    const orden = await nuevaOrden();
    await envejecer(orden.id, 6);
    await pool.execute("UPDATE service_orders SET notes = 'Se compró la pieza' WHERE id = ?", [orden.id]);
    const ids = (await modeloOrdenes.listStalled({ hours: 72 })).map((o) => o.id);
    expect(ids).toContain(orden.id);
  });

  test('sin_registros_en_el_historial_se_mide_desde_la_fecha_de_creacion', async () => {
    const orden = await nuevaOrden();
    await pool.execute('DELETE FROM order_status_history WHERE orderId = ?', [orden.id]);
    await pool.execute('UPDATE service_orders SET createdAt = DATE_SUB(NOW(), INTERVAL 4 DAY) WHERE id = ?', [orden.id]);
    expect((await modeloOrdenes.listStalled({ hours: 72 })).map((o) => o.id)).toContain(orden.id);
  });

  test('las_ordenes_terminadas_entregadas_y_canceladas_no_cuentan', async () => {
    const ids = [];
    for (const status of ['TERMINADO', 'ENTREGADO', 'CANCELADA']) {
      const orden = await nuevaOrden({ status });
      await envejecer(orden.id, 10);
      ids.push(orden.id);
    }
    const detenidas = (await modeloOrdenes.listStalled({ hours: 72 })).map((o) => o.id);
    for (const id of ids) expect(detenidas).not.toContain(id);
  });

  test('filtra_por_mecanico_y_excluye_a_los_clientes_desactivados', async () => {
    const otro = await crearSegundoMecanico();
    const { clientId, vehicleId } = await crearClienteConVehiculo();
    const ajena = await crearOrden({
      clientId, vehicleId, mechanicId: otro.id, createdBy: usuarios.RECEPTIONIST.id,
    });
    await envejecer(ajena, 5);
    const suya = await nuevaOrden();
    await envejecer(suya.id, 5);
    const desactivado = await nuevaOrden();
    await envejecer(desactivado.id, 5);
    await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [desactivado.clientId]);

    const delMecanico = (await modeloOrdenes.listStalled({ hours: 72, mechanicId: usuarios.MECHANIC.id })).map((o) => o.id);
    expect(delMecanico).toContain(suya.id);
    expect(delMecanico).not.toContain(ajena);
    expect(delMecanico).not.toContain(desactivado.id);
    expect((await modeloOrdenes.listStalled({ hours: 72 })).map((o) => o.id)).toContain(ajena);
  });
});

describe('orderModel.listReadyForPickup (órdenes Terminadas sin entregar)', () => {
  test('incluye_las_terminadas_con_el_cliente_su_telefono_y_el_vehiculo_y_excluye_las_entregadas', async () => {
    const lista = await nuevaOrden({ status: 'TERMINADO' });
    const entregada = await nuevaOrden({ status: 'ENTREGADO' });
    const filas = await modeloOrdenes.listReadyForPickup();
    const fila = filas.find((o) => o.id === lista.id);
    expect(fila).toBeDefined();
    expect(fila).toMatchObject({ clientId: lista.clientId, vehicleId: lista.vehicleId });
    expect(fila.clientPhone).toMatch(/^\d+$/);
    expect(fila.licensePlate).toMatch(/^TST-/);
    expect(fila.finishedAt).toBeInstanceOf(Date);
    expect(filas.map((o) => o.id)).not.toContain(entregada.id);
  });

  test('excluye_a_los_clientes_desactivados', async () => {
    const orden = await nuevaOrden({ status: 'TERMINADO' });
    await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [orden.clientId]);
    expect((await modeloOrdenes.listReadyForPickup()).map((o) => o.id)).not.toContain(orden.id);
  });
});

describe('appointmentModel.listByDay (citas de un día)', () => {
  test('devuelve_las_pendientes_y_confirmadas_de_ese_dia_con_hora_cliente_y_placa_ordenadas_por_hora', async () => {
    const { clientId, vehicleId } = await crearClienteConVehiculo();
    const tarde = await crearCita({ clientId, vehicleId, createdBy: usuarios.RECEPTIONIST.id, status: 'PENDIENTE', dias: 0, hora: '15:30' });
    const temprano = await crearCita({ clientId, vehicleId, createdBy: usuarios.RECEPTIONIST.id, status: 'CONFIRMADA', dias: 0, hora: '09:05' });
    await crearCita({ clientId, vehicleId, createdBy: usuarios.RECEPTIONIST.id, status: 'CANCELADA', dias: 0, hora: '10:00' });
    await crearCita({ clientId, vehicleId, createdBy: usuarios.RECEPTIONIST.id, status: 'COMPLETADA', dias: 0, hora: '11:00' });
    const manana = await crearCita({ clientId, vehicleId, createdBy: usuarios.RECEPTIONIST.id, status: 'CONFIRMADA', dias: 1, hora: '08:00' });

    const hoy = (await modeloCitas.listByDay(fechaDia(0))).filter((c) => [tarde, temprano, manana].includes(c.id));
    expect(hoy.map((c) => c.id)).toEqual([temprano, tarde]);
    expect(hoy[0]).toMatchObject({ time: '09:05', clientId, vehicleId });
    expect(hoy[0].licensePlate).toMatch(/^TST-/);
    expect((await modeloCitas.listByDay(fechaDia(1))).map((c) => c.id)).toContain(manana);
  });

  test('no_incluye_las_citas_de_clientes_desactivados', async () => {
    const { clientId, vehicleId } = await crearClienteConVehiculo();
    const id = await crearCita({ clientId, vehicleId, createdBy: usuarios.RECEPTIONIST.id, status: 'PENDIENTE', dias: 0, hora: '12:00' });
    await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [clientId]);
    expect((await modeloCitas.listByDay(fechaDia(0))).map((c) => c.id)).not.toContain(id);
  });
});

describe('partModel.listAlerts (stock bajo o agotado)', () => {
  test('devuelve_solo_las_activas_con_stock_bajo_o_agotado_y_su_nivel', async () => {
    const agotada = await crearRefaccion({ stock: 0, minimumStock: 2 });
    const baja = await crearRefaccion({ stock: 2, minimumStock: 2 });
    const normal = await crearRefaccion({ stock: 9, minimumStock: 2 });
    const inactiva = await crearRefaccion({ stock: 0, minimumStock: 2, active: 0 });
    const alertas = await modeloRefacciones.listAlerts();
    const nivel = (id) => alertas.find((p) => p.id === id)?.stockLevel;
    expect(nivel(agotada.id)).toBe('OUT');
    expect(nivel(baja.id)).toBe('LOW');
    expect(nivel(normal.id)).toBeUndefined();
    expect(nivel(inactiva.id)).toBeUndefined();
  });

  test('el_total_coincide_con_el_resumen_de_inventario', async () => {
    const resumen = await modeloRefacciones.summary();
    expect((await modeloRefacciones.listAlerts()).length).toBe(resumen.low + resumen.out);
  });

  test('no_expone_precios', async () => {
    await crearRefaccion({ stock: 0, minimumStock: 1 });
    const [primera] = await modeloRefacciones.listAlerts();
    expect(primera).not.toHaveProperty('purchasePrice');
    expect(primera).not.toHaveProperty('salePrice');
  });
});

describe('maintenanceService.listAllClassified', () => {
  test('devuelve_todos_los_pendientes_clasificados_sin_paginar_y_filtra_por_clasificacion', async () => {
    const { clientId, vehicleId } = await crearClienteConVehiculo({ km: 40000 });
    const vencido = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, nextMileage: 35000 });
    const proximo = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Frenos', nextDate: fechaDia(5) });
    const normal = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Llantas', nextDate: fechaDia(90) });
    const atendido = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, serviceType: 'Batería', nextDate: fechaDia(2), status: 'ATENDIDO' });

    const todos = await maintenanceService.listAllClassified({});
    const clase = (id) => todos.find((m) => m.id === id)?.classification;
    expect(clase(vencido)).toBe('VENCIDO');
    expect(clase(proximo)).toBe('PROXIMO');
    expect(clase(normal)).toBe('NORMAL');
    expect(todos.find((m) => m.id === atendido)).toBeUndefined();

    const soloAvisos = await maintenanceService.listAllClassified({ classification: ['VENCIDO', 'PROXIMO'] });
    expect(soloAvisos.map((m) => m.id)).toEqual(expect.arrayContaining([vencido, proximo]));
    expect(soloAvisos.map((m) => m.id)).not.toContain(normal);
    expect(soloAvisos[0].client.id).toBe(clientId);
  });

  test('puede_excluir_a_los_clientes_desactivados_sin_cambiar_el_comportamiento_de_list', async () => {
    const { clientId, vehicleId } = await crearClienteConVehiculo({ km: 40000 });
    const id = await crearMantenimiento({ vehicleId, createdBy: usuarios.ADMIN.id, nextMileage: 35000 });
    await pool.execute('UPDATE clients SET active = 0 WHERE id = ?', [clientId]);
    const todos = await maintenanceService.listAllClassified({});
    expect(todos.map((m) => m.id)).toContain(id);
    const activos = await maintenanceService.listAllClassified({ onlyActiveClients: true });
    expect(activos.map((m) => m.id)).not.toContain(id);
    const lista = await maintenanceService.list({ status: 'PENDIENTE', page: 1, pageSize: 100 });
    expect(lista.items.map((m) => m.id)).toContain(id);
  });
});

describe('notificationModel (lecturas por usuario)', () => {
  test('guardar_dos_veces_la_misma_lectura_no_duplica_y_cada_usuario_tiene_las_suyas', async () => {
    await modeloLecturas.saveRead(usuarios.ADMIN.id, 'STOCK:5:AGOTADO');
    await modeloLecturas.saveRead(usuarios.ADMIN.id, 'STOCK:5:AGOTADO');
    await modeloLecturas.saveRead(usuarios.RECEPTIONIST.id, 'CITA:8');
    expect(await modeloLecturas.listReads(usuarios.ADMIN.id)).toEqual(['STOCK:5:AGOTADO']);
    expect(await modeloLecturas.listReads(usuarios.RECEPTIONIST.id)).toEqual(['CITA:8']);
  });

  test('borra_solo_las_lecturas_indicadas_del_usuario', async () => {
    await modeloLecturas.saveRead(usuarios.MECHANIC.id, 'ORDEN:1');
    await modeloLecturas.saveRead(usuarios.MECHANIC.id, 'ORDEN:2');
    await modeloLecturas.deleteReads(usuarios.MECHANIC.id, ['ORDEN:1']);
    await modeloLecturas.deleteReads(usuarios.MECHANIC.id, []);
    expect(await modeloLecturas.listReads(usuarios.MECHANIC.id)).toEqual(['ORDEN:2']);
    expect(await modeloLecturas.listReads(usuarios.ADMIN.id)).toEqual(['STOCK:5:AGOTADO']);
  });
});

describe('clientNoticeModel (avisos a clientes)', () => {
  test('el_primer_aviso_de_un_hecho_se_crea_y_el_segundo_no_duplica', async () => {
    const { clientId } = await crearClienteConVehiculo();
    const datos = { clientId, kind: 'ORDEN_LISTA', factId: 4001, noticedBy: usuarios.RECEPTIONIST.id, note: 'No contestó' };
    const primero = await modeloAvisosClientes.insertIfAbsent(null, datos);
    expect(primero.created).toBe(true);
    const segundo = await modeloAvisosClientes.insertIfAbsent(null, { ...datos, note: 'Otra nota' });
    expect(segundo.created).toBe(false);

    const registro = await modeloAvisosClientes.findByFact('ORDEN_LISTA', 4001);
    expect(registro).toMatchObject({ client: { id: clientId }, kind: 'ORDEN_LISTA', factId: 4001, note: 'No contestó' });
    expect(registro.noticedBy.id).toBe(usuarios.RECEPTIONIST.id);
    expect(registro.noticedAt).toBeInstanceOf(Date);
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM client_notices WHERE kind = 'ORDEN_LISTA' AND factId = 4001");
    expect(n).toBe(1);
  });

  test('un_hecho_nuevo_o_la_misma_clave_con_otro_tipo_es_un_registro_distinto', async () => {
    const { clientId } = await crearClienteConVehiculo();
    const base = { clientId, factId: 4002, noticedBy: usuarios.ADMIN.id };
    expect((await modeloAvisosClientes.insertIfAbsent(null, { ...base, kind: 'MANTENIMIENTO_PROXIMO' })).created).toBe(true);
    expect((await modeloAvisosClientes.insertIfAbsent(null, { ...base, kind: 'MANTENIMIENTO_VENCIDO' })).created).toBe(true);
    const avisados = await modeloAvisosClientes.listNoticed();
    expect(avisados).toEqual(expect.arrayContaining([
      { kind: 'MANTENIMIENTO_PROXIMO', factId: 4002 },
      { kind: 'MANTENIMIENTO_VENCIDO', factId: 4002 },
    ]));
  });

  test('la_nota_es_opcional_y_se_guarda_como_nula', async () => {
    const { clientId } = await crearClienteConVehiculo();
    await modeloAvisosClientes.insertIfAbsent(null, { clientId, kind: 'CITA_MANANA', factId: 4003, noticedBy: usuarios.ADMIN.id });
    expect((await modeloAvisosClientes.findByFact('CITA_MANANA', 4003)).note).toBeNull();
  });

  test('hoy_y_manana_usan_el_mismo_formato_de_fecha_del_panel', () => {
    expect(hoyLocal()).toBe(fechaLocal(0).slice(0, 10));
  });
});
