// Los datos de ejemplo del Sprint 6 muestran un caso de cada tipo de aviso y son idempotentes (FR-021, SC-007).
import request from 'supertest';
import { app } from '../../app.js';
import { pool } from '../../config/db.js';
import { aplicarSeeds, cerrarConexiones, emitirToken, limpiarBase } from '../helpers.js';

const TABLAS = [
  'users', 'clients', 'vehicles', 'appointments', 'service_orders', 'order_status_history', 'order_services', 'order_labor',
  'order_parts', 'parts', 'inventory_movements', 'maintenance', 'payments', 'tickets', 'notification_reads', 'client_notices',
];

const conteos = async () => {
  const resultado = {};
  for (const tabla of TABLAS) {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`);
    resultado[tabla] = total;
  }
  return resultado;
};

const tokenDe = async (username) => {
  const [[{ id }]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  return emitirToken(id);
};

beforeAll(async () => {
  await limpiarBase();
  aplicarSeeds();
}, 120000);
afterAll(cerrarConexiones);

describe('Datos de ejemplo de notificaciones (integración, Sprint 6)', () => {
  test('cargar_los_seeds_dos_veces_no_cambia_el_conteo_de_ninguna_tabla', async () => {
    const primera = await conteos();
    expect(primera.client_notices).toBeGreaterThan(0);
    aplicarSeeds();
    expect(await conteos()).toEqual(primera);
  }, 120000);

  test('el_administrador_recibe_al_menos_un_aviso_de_cada_tipo', async () => {
    const r = await request(app).get('/api/notifications').set('Authorization', `Bearer ${await tokenDe('admin')}`);
    expect(r.status).toBe(200);
    const tipos = r.body.data.groups.map((g) => g.type);
    for (const tipo of ['MAINTENANCE_OVERDUE', 'MAINTENANCE_SOON', 'APPOINTMENT_TODAY', 'STOCK_OUT', 'STOCK_LOW', 'ORDER_STALLED']) {
      expect(tipos).toContain(tipo);
    }
    expect(r.body.data.clientsToNotify).toBeGreaterThan(0);
  });

  test('el_mecanico_de_ejemplo_ve_la_orden_detenida_asignada_a_el', async () => {
    const r = await request(app).get('/api/notifications').set('Authorization', `Bearer ${await tokenDe('mecanico')}`);
    const grupo = r.body.data.groups.find((g) => g.type === 'ORDER_STALLED');
    expect(grupo.items.some((i) => i.data.daysStalled >= 5)).toBe(true);
    expect(r.body.data.groups).toHaveLength(1);
  });

  test('recepcion_ve_clientes_por_avisar_de_cada_motivo_y_el_ya_avisado_no_aparece', async () => {
    const r = await request(app).get('/api/client-notices?pageSize=100').set('Authorization', `Bearer ${await tokenDe('recepcion')}`);
    expect(r.status).toBe(200);
    const motivos = new Set(r.body.data.map((h) => h.kind));
    for (const motivo of ['ORDEN_LISTA', 'CITA_MANANA', 'MANTENIMIENTO_PROXIMO', 'MANTENIMIENTO_VENCIDO']) {
      expect(motivos).toContain(motivo);
    }
    const [[avisado]] = await pool.query("SELECT factId FROM client_notices WHERE kind = 'MANTENIMIENTO_VENCIDO' LIMIT 1");
    expect(r.body.data.some((h) => h.kind === 'MANTENIMIENTO_VENCIDO' && h.factId === avisado.factId)).toBe(false);
  });
});
