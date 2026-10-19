// El panel debe coincidir con la información de cada módulo de origen (FR-027, SC-007).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import {
  cerrarConexiones,
  crearCita,
  crearClienteConVehiculo,
  crearMantenimiento,
  crearOrden,
  crearOrdenCobrable,
  crearPago,
  crearRefaccion,
  crearUsuariosDePrueba,
  fechaDia,
  limpiarBase,
} from '../helpers.js';

let usuarios;
const como = (rol) => ({ Authorization: `Bearer ${usuarios[rol].token}` });
const leer = async (ruta, rol = 'ADMIN') => (await request(app).get(ruta).set(como(rol))).body;

beforeAll(async () => {
  await limpiarBase();
  usuarios = await crearUsuariosDePrueba();
  const base = { mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id };

  // Órdenes: en varios estados y con distintos cobros.
  const a = await crearClienteConVehiculo();
  await crearOrden({ ...a, ...base, status: 'RECIBIDO' });
  await crearOrden({ ...a, ...base, status: 'EN_REPARACION' });
  await crearOrden({ ...a, ...base, status: 'CANCELADA' });
  const pagada = await crearOrdenCobrable({ ...a, ...base, total: 1000, status: 'ENTREGADO' });
  const parcial = await crearOrdenCobrable({ ...a, ...base, total: 2000 });
  const sinPagos = await crearOrdenCobrable({ ...a, ...base, total: 500 });
  await crearOrdenCobrable({ ...a, ...base, total: 0 });
  await crearPago({ orderId: pagada, createdBy: usuarios.ADMIN.id, amount: 1000, method: 'EFECTIVO' });
  await crearPago({ orderId: parcial, createdBy: usuarios.ADMIN.id, amount: 750.25, method: 'TARJETA' });
  await crearPago({ orderId: parcial, createdBy: usuarios.ADMIN.id, amount: 400, method: 'MERCADO_PAGO', status: 'RECHAZADO', externalReference: 'd-1' });
  await crearPago({ orderId: parcial, createdBy: usuarios.ADMIN.id, amount: 300, method: 'MERCADO_PAGO', status: 'PENDIENTE', externalReference: 'd-2' });
  // Un pago del mes anterior no cuenta como cobrado hoy ni este mes.
  const viejo = await crearPago({ orderId: sinPagos, createdBy: usuarios.ADMIN.id, amount: 100, method: 'EFECTIVO' });
  await pool.execute("UPDATE payments SET paidAt = DATE_SUB(NOW(), INTERVAL 45 DAY) WHERE id = ?", [viejo]);

  // Citas: hoy (aunque la hora ya haya pasado), próximos días, fuera de rango y canceladas.
  await crearCita({ clientId: a.clientId, vehicleId: a.vehicleId, createdBy: usuarios.ADMIN.id, dias: 0, hora: '00:30', status: 'CONFIRMADA' });
  await crearCita({ clientId: a.clientId, vehicleId: a.vehicleId, createdBy: usuarios.ADMIN.id, dias: 0, hora: '23:30' });
  await crearCita({ clientId: a.clientId, vehicleId: a.vehicleId, createdBy: usuarios.ADMIN.id, dias: 3 });
  await crearCita({ clientId: a.clientId, vehicleId: a.vehicleId, createdBy: usuarios.ADMIN.id, dias: 7, status: 'CONFIRMADA' });
  await crearCita({ clientId: a.clientId, vehicleId: a.vehicleId, createdBy: usuarios.ADMIN.id, dias: 8 });
  await crearCita({ clientId: a.clientId, vehicleId: a.vehicleId, createdBy: usuarios.ADMIN.id, dias: 2, status: 'CANCELADA' });

  // Mantenimientos: uno vencido, dos próximos y uno normal.
  const b = await crearClienteConVehiculo({ km: 50000 });
  const m = { vehicleId: b.vehicleId, createdBy: usuarios.ADMIN.id, lastMileage: 30000 };
  await crearMantenimiento({ ...m, serviceType: 'Vencido', nextDate: fechaDia(-2) });
  await crearMantenimiento({ ...m, serviceType: 'Próximo A', nextDate: fechaDia(10) });
  await crearMantenimiento({ ...m, serviceType: 'Próximo B', nextMileage: 50400 });
  await crearMantenimiento({ ...m, serviceType: 'Normal', nextDate: fechaDia(200) });

  // Inventario: una agotada, dos con stock bajo, una en orden y una desactivada agotada.
  await crearRefaccion({ stock: 0, minimumStock: 3, name: 'Agotada' });
  await crearRefaccion({ stock: 1, minimumStock: 4, name: 'Baja uno' });
  await crearRefaccion({ stock: 2, minimumStock: 2, name: 'Baja dos' });
  await crearRefaccion({ stock: 50, minimumStock: 2, name: 'En orden' });
  await crearRefaccion({ stock: 0, minimumStock: 2, name: 'Inactiva', active: 0 });
});

afterAll(cerrarConexiones);

describe('Panel de control: cada cifra coincide con su módulo', () => {
  test('ordenes_por_estado_coinciden_con_el_listado_de_ordenes', async () => {
    const { data } = await leer('/api/dashboard');
    for (const [estado, cantidad] of Object.entries(data.orders.byStatus)) {
      const lista = await leer(`/api/orders?status=${estado}&pageSize=100`);
      expect(lista.meta.total).toBe(cantidad);
    }
    expect(Object.values(data.orders.byStatus).reduce((s, n) => s + n, 0)).toBe((await leer('/api/orders?pageSize=100')).meta.total);
  });

  test('las_ordenes_con_saldo_y_lo_pendiente_de_cobrar_coinciden_con_el_resumen_de_cada_orden', async () => {
    const { data } = await leer('/api/dashboard');
    let cantidad = 0;
    let centavos = 0;
    for (const estado of ['TERMINADO', 'ENTREGADO']) {
      for (const orden of (await leer(`/api/orders?status=${estado}&pageSize=100`)).data) {
        const { summary } = (await leer(`/api/orders/${orden.id}/payments`)).data;
        if (Number(summary.balance) > 0) {
          cantidad += 1;
          centavos += Math.round(Number(summary.balance) * 100);
        }
      }
    }
    expect(data.orders.withBalance.count).toBe(cantidad);
    expect(data.orders.withBalance.count).toBe(2); // la parcial (1249.75) y la de 500 con un pago antiguo de 100 (400); la de total cero y la pagada no
    expect(data.orders.withBalance.amount).toBe((centavos / 100).toFixed(2));
    expect(data.payments.pendingToCollect).toBe('1649.75');
  });

  test('lo_cobrado_hoy_y_en_el_mes_solo_cuenta_pagos_PAGADO_de_ese_periodo', async () => {
    const { data } = await leer('/api/dashboard');
    // 1000.00 + 750.25 pagados hoy; los rechazados, pendientes y el pago de hace 45 días no cuentan hoy.
    expect(data.payments.collectedToday).toBe('1750.25');
    const [[{ mes }]] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS mes FROM payments WHERE status = 'PAGADO' AND paidAt >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
    );
    expect(data.payments.collectedMonth).toBe(Number(mes).toFixed(2));
  });

  test('las_citas_de_hoy_y_de_los_proximos_7_dias_coinciden_con_la_agenda', async () => {
    const { data } = await leer('/api/dashboard');
    const hoy = fechaDia(0);
    const agendaHoy = await leer(`/api/appointments?from=${hoy}&to=${hoy}&pageSize=100`);
    const abiertasHoy = agendaHoy.data.filter((c) => ['PENDIENTE', 'CONFIRMADA'].includes(c.status)).length;
    expect(data.appointments.today).toBe(abiertasHoy);
    expect(data.appointments.today).toBe(2);
    const proximas = await leer(`/api/appointments?from=${fechaDia(1)}&to=${fechaDia(7)}&pageSize=100`);
    expect(data.appointments.upcoming).toBe(proximas.data.filter((c) => ['PENDIENTE', 'CONFIRMADA'].includes(c.status)).length);
    expect(data.appointments.upcoming).toBe(2); // día 3 y día 7; el 8 y la cancelada no
    expect(data.appointments.next.length).toBeLessThanOrEqual(5);
    expect(data.appointments.next.map((c) => c.status).every((s) => ['PENDIENTE', 'CONFIRMADA'].includes(s))).toBe(true);
  });

  test('los_mantenimientos_vencidos_y_proximos_coinciden_con_la_lista', async () => {
    const { data } = await leer('/api/dashboard');
    expect(data.maintenance.overdue).toBe((await leer('/api/maintenance?classification=VENCIDO')).meta.total);
    expect(data.maintenance.soon).toBe((await leer('/api/maintenance?classification=PROXIMO')).meta.total);
    expect(data.maintenance).toEqual({ overdue: 1, soon: 2 });
  });

  test('las_alertas_de_inventario_coinciden_con_el_resumen_y_las_mas_urgentes_van_primero', async () => {
    const { data } = await leer('/api/dashboard');
    const resumen = (await leer('/api/parts/summary')).data;
    expect(data.inventory.low).toBe(resumen.low);
    expect(data.inventory.out).toBe(resumen.out);
    expect(data.inventory).toMatchObject({ low: 2, out: 1 });
    expect(data.inventory.mostUrgent.map((p) => p.name)).toEqual(['Agotada', 'Baja uno', 'Baja dos']);
    expect(JSON.stringify(data.inventory)).not.toContain('purchasePrice');
  });

  test('el_panel_se_calcula_en_cada_consulta_y_refleja_los_cambios_al_instante', async () => {
    const antes = (await leer('/api/dashboard')).data.payments.collectedToday;
    const cliente = await crearClienteConVehiculo();
    const orden = await crearOrdenCobrable({ ...cliente, mechanicId: usuarios.MECHANIC.id, createdBy: usuarios.RECEPTIONIST.id, total: 300 });
    await request(app).post(`/api/orders/${orden}/payments`).set(como('RECEPTIONIST')).send({ method: 'EFECTIVO', amount: 300 });
    const despues = (await leer('/api/dashboard')).data.payments.collectedToday;
    expect((Number(despues) - Number(antes)).toFixed(2)).toBe('300.00');
  });

  test('responde_en_menos_de_3_segundos', async () => {
    const inicio = Date.now();
    await leer('/api/dashboard');
    expect(Date.now() - inicio).toBeLessThan(3000);
  });
});
