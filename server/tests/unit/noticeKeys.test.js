// Claves, visibilidad por rol y orden por urgencia de los avisos (Sprint 6, FR-002, FR-006, FR-009).
import { NOTICE_TYPE } from '../../utils/constants.js';
import {
  GROUP_ORDER,
  buildKey,
  compareFor,
  parseKey,
  typesForRole,
} from '../../services/noticeKeys.js';

describe('Claves de aviso', () => {
  test.each([
    [NOTICE_TYPE.MAINTENANCE_OVERDUE, 12, 'MANT:12:VENCIDO'],
    [NOTICE_TYPE.MAINTENANCE_SOON, 12, 'MANT:12:PROXIMO'],
    [NOTICE_TYPE.STOCK_OUT, 5, 'STOCK:5:AGOTADO'],
    [NOTICE_TYPE.STOCK_LOW, 5, 'STOCK:5:BAJO'],
    [NOTICE_TYPE.APPOINTMENT_TODAY, 8, 'CITA:8'],
    [NOTICE_TYPE.ORDER_STALLED, 7, 'ORDEN:7'],
  ])('construye_y_lee_la_clave_de_%s', (tipo, id, clave) => {
    expect(buildKey(tipo, id)).toBe(clave);
    expect(parseKey(clave)).toEqual({ type: tipo, id });
  });

  test('un_mantenimiento_que_empeora_cambia_de_clave', () => {
    expect(buildKey(NOTICE_TYPE.MAINTENANCE_SOON, 3)).not.toBe(buildKey(NOTICE_TYPE.MAINTENANCE_OVERDUE, 3));
  });

  test('una_refaccion_que_se_agota_cambia_de_clave', () => {
    expect(buildKey(NOTICE_TYPE.STOCK_LOW, 3)).not.toBe(buildKey(NOTICE_TYPE.STOCK_OUT, 3));
  });

  test.each(['', 'MANT', 'MANT:1', 'MANT:1:NORMAL', 'MANT:x:VENCIDO', 'STOCK:1:VENCIDO', 'CITA:0', 'CITA:-2', 'ORDEN:1:2',
    'orden:1', 'ORDEN:1.5', null, undefined, 42])('rechaza_la_clave_mal_formada_%p', (clave) => {
    expect(parseKey(clave)).toBeNull();
  });

  test('construir_con_un_tipo_o_un_id_invalido_lanza_un_error', () => {
    expect(() => buildKey('OTRO', 1)).toThrow();
    expect(() => buildKey(NOTICE_TYPE.ORDER_STALLED, 0)).toThrow();
    expect(() => buildKey(NOTICE_TYPE.ORDER_STALLED, 'a')).toThrow();
  });

  test('las_claves_caben_en_la_columna_de_60_caracteres', () => {
    expect(buildKey(NOTICE_TYPE.MAINTENANCE_OVERDUE, 4294967295).length).toBeLessThanOrEqual(60);
  });
});

describe('Tipos de aviso permitidos por rol', () => {
  test('el_administrador_recibe_todos_los_tipos', () => {
    expect(typesForRole('ADMIN').sort()).toEqual(Object.values(NOTICE_TYPE).sort());
  });

  test('recepcion_recibe_mantenimientos_citas_y_ordenes_detenidas_pero_nunca_stock', () => {
    const tipos = typesForRole('RECEPTIONIST');
    expect(tipos.sort()).toEqual([
      NOTICE_TYPE.MAINTENANCE_OVERDUE,
      NOTICE_TYPE.MAINTENANCE_SOON,
      NOTICE_TYPE.APPOINTMENT_TODAY,
      NOTICE_TYPE.ORDER_STALLED,
    ].sort());
    expect(tipos).not.toContain(NOTICE_TYPE.STOCK_LOW);
    expect(tipos).not.toContain(NOTICE_TYPE.STOCK_OUT);
  });

  test('el_mecanico_solo_recibe_ordenes_detenidas', () => {
    expect(typesForRole('MECHANIC')).toEqual([NOTICE_TYPE.ORDER_STALLED]);
  });

  test('un_rol_desconocido_no_recibe_nada', () => {
    expect(typesForRole('CLIENTE')).toEqual([]);
    expect(typesForRole(undefined)).toEqual([]);
  });

  test('el_orden_de_los_grupos_incluye_cada_tipo_una_sola_vez', () => {
    expect([...GROUP_ORDER].sort()).toEqual(Object.values(NOTICE_TYPE).sort());
  });
});

describe('Orden por urgencia dentro de cada tipo', () => {
  const ordenar = (tipo, items) => [...items].sort(compareFor(tipo)).map((i) => i.id);

  test('mantenimientos_vencidos_el_mas_pasado_primero_por_dias_o_por_kilometros', () => {
    const items = [
      { id: 1, data: { daysLeft: -2, kmLeft: null } },
      { id: 2, data: { daysLeft: -30, kmLeft: null } },
      { id: 3, data: { daysLeft: null, kmLeft: -5000 } }, // equivale a -100 días
      { id: 4, data: { daysLeft: null, kmLeft: -50 } },
    ];
    expect(ordenar(NOTICE_TYPE.MAINTENANCE_OVERDUE, items)).toEqual([3, 2, 1, 4]);
  });

  test('mantenimientos_proximos_el_que_vence_antes_primero', () => {
    const items = [
      { id: 1, data: { daysLeft: 10, kmLeft: null } },
      { id: 2, data: { daysLeft: 1, kmLeft: null } },
      { id: 3, data: { daysLeft: null, kmLeft: 100 } }, // equivale a 2 días
    ];
    expect(ordenar(NOTICE_TYPE.MAINTENANCE_SOON, items)).toEqual([2, 3, 1]);
  });

  test('citas_del_dia_por_hora', () => {
    const items = [
      { id: 1, data: { time: '15:30' } },
      { id: 2, data: { time: '09:00' } },
      { id: 3, data: { time: '09:00' } },
    ];
    expect(ordenar(NOTICE_TYPE.APPOINTMENT_TODAY, items)).toEqual([2, 3, 1]);
  });

  test('stock_el_mas_por_debajo_de_su_minimo_primero_y_luego_por_nombre', () => {
    const items = [
      { id: 1, data: { name: 'Bujía', stock: 1, minimumStock: 4 } },
      { id: 2, data: { name: 'Aceite', stock: 0, minimumStock: 5 } },
      { id: 3, data: { name: 'Filtro', stock: 1, minimumStock: 4 } },
    ];
    expect(ordenar(NOTICE_TYPE.STOCK_LOW, items)).toEqual([2, 1, 3]);
    expect(ordenar(NOTICE_TYPE.STOCK_OUT, items)).toEqual([2, 1, 3]);
  });

  test('ordenes_detenidas_de_mas_a_menos_dias', () => {
    const items = [
      { id: 1, data: { daysStalled: 3 } },
      { id: 2, data: { daysStalled: 9 } },
      { id: 3, data: { daysStalled: 3 } },
    ];
    expect(ordenar(NOTICE_TYPE.ORDER_STALLED, items)).toEqual([2, 1, 3]);
  });

  test('un_tipo_desconocido_lanza_un_error', () => {
    expect(() => compareFor('OTRO')).toThrow();
  });
});
