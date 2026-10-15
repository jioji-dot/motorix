import { ORDER_STATUS_VALUES } from '../../config/constants.js';
import {
  allowedTransitions,
  allowedTransitionsFor,
  canEditWork,
  canRoleTransition,
  canTransition,
  isBasicDataEditable,
  isNotesEditable,
  isWorkEditable
} from '../../utils/orderStatus.js';

const VALIDAS = [
  ['RECIBIDO', 'DIAGNOSTICO'],
  ['DIAGNOSTICO', 'EN_REPARACION'],
  ['EN_REPARACION', 'ESPERANDO_REFACCION'],
  ['ESPERANDO_REFACCION', 'EN_REPARACION'],
  ['EN_REPARACION', 'TERMINADO'],
  ['TERMINADO', 'ENTREGADO']
];

const admin = { id: 1, role: 'ADMIN' };
const recepcion = { id: 2, role: 'RECEPTIONIST' };
const asignado = { id: 3, role: 'MECHANIC' };
const ajeno = { id: 4, role: 'MECHANIC' };
const orden = (status) => ({ status, mechanicId: 3 });

describe('matriz de transiciones de estado de la orden', () => {
  const pares = ORDER_STATUS_VALUES.flatMap((desde) =>
    ORDER_STATUS_VALUES.map((hacia) => [desde, hacia])
  );

  test.each(pares)('test_transicion_%s_a_%s', (desde, hacia) => {
    const esperada = VALIDAS.some(([d, h]) => d === desde && h === hacia);
    expect(canTransition(desde, hacia)).toBe(esperada);
  });

  test('test_hay_exactamente_seis_transiciones_validas', () => {
    const total = ORDER_STATUS_VALUES.reduce((suma, e) => suma + allowedTransitions(e).length, 0);
    expect(total).toBe(6);
  });

  test('test_entregado_es_terminal_y_no_hay_retrocesos', () => {
    expect(allowedTransitions('ENTREGADO')).toEqual([]);
    expect(canTransition('TERMINADO', 'EN_REPARACION')).toBe(false);
    expect(canTransition('DIAGNOSTICO', 'RECIBIDO')).toBe(false);
  });

  test('test_el_estado_actual_desconocido_no_tiene_transiciones', () => {
    expect(allowedTransitions('INEXISTENTE')).toEqual([]);
    expect(canTransition('INEXISTENTE', 'RECIBIDO')).toBe(false);
  });
});

describe('quién puede ejecutar cada transición', () => {
  test.each(VALIDAS.filter(([, hacia]) => hacia !== 'ENTREGADO'))(
    'test_%s_a_%s_lo_hacen_el_administrador_y_el_mecanico_asignado',
    (desde, hacia) => {
      const o = orden(desde);
      expect(canRoleTransition({ user: admin, order: o, to: hacia })).toBe(true);
      expect(canRoleTransition({ user: asignado, order: o, to: hacia })).toBe(true);
      expect(canRoleTransition({ user: recepcion, order: o, to: hacia })).toBe(false);
      expect(canRoleTransition({ user: ajeno, order: o, to: hacia })).toBe(false);
    }
  );

  test('test_solo_recepcion_y_administrador_marcan_entregado', () => {
    const o = orden('TERMINADO');
    expect(canRoleTransition({ user: recepcion, order: o, to: 'ENTREGADO' })).toBe(true);
    expect(canRoleTransition({ user: admin, order: o, to: 'ENTREGADO' })).toBe(true);
    expect(canRoleTransition({ user: asignado, order: o, to: 'ENTREGADO' })).toBe(false);
    expect(canRoleTransition({ user: ajeno, order: o, to: 'ENTREGADO' })).toBe(false);
  });

  test('test_una_orden_sin_mecanico_no_la_avanza_ningun_mecanico', () => {
    const sinMecanico = { status: 'RECIBIDO', mechanicId: null };
    expect(canRoleTransition({ user: asignado, order: sinMecanico, to: 'DIAGNOSTICO' })).toBe(false);
    expect(canRoleTransition({ user: admin, order: sinMecanico, to: 'DIAGNOSTICO' })).toBe(true);
  });

  test('test_las_transiciones_ofrecidas_a_cada_rol_en_terminado', () => {
    const o = orden('TERMINADO');
    expect(allowedTransitionsFor({ user: recepcion, order: o })).toEqual(['ENTREGADO']);
    expect(allowedTransitionsFor({ user: admin, order: o })).toEqual(['ENTREGADO']);
    expect(allowedTransitionsFor({ user: asignado, order: o })).toEqual([]);
  });

  test('test_las_transiciones_ofrecidas_al_mecanico_en_reparacion', () => {
    const o = orden('EN_REPARACION');
    expect(allowedTransitionsFor({ user: asignado, order: o }).sort()).toEqual(
      ['ESPERANDO_REFACCION', 'TERMINADO'].sort()
    );
    expect(allowedTransitionsFor({ user: recepcion, order: o })).toEqual([]);
    expect(allowedTransitionsFor({ user: ajeno, order: o })).toEqual([]);
  });
});

describe('estados en los que se puede editar', () => {
  test.each([
    ['RECIBIDO', true],
    ['DIAGNOSTICO', true],
    ['EN_REPARACION', true],
    ['ESPERANDO_REFACCION', true],
    ['TERMINADO', false],
    ['ENTREGADO', false]
  ])('test_diagnostico_servicios_y_mano_de_obra_en_%s_%s', (estado, esperado) => {
    expect(isWorkEditable(estado)).toBe(esperado);
  });

  test.each([
    ['RECIBIDO', true],
    ['DIAGNOSTICO', true],
    ['EN_REPARACION', true],
    ['ESPERANDO_REFACCION', true],
    ['TERMINADO', true],
    ['ENTREGADO', false]
  ])('test_observaciones_y_recomendaciones_en_%s_%s', (estado, esperado) => {
    expect(isNotesEditable(estado)).toBe(esperado);
  });

  test.each([
    ['RECIBIDO', true],
    ['DIAGNOSTICO', true],
    ['EN_REPARACION', true],
    ['ESPERANDO_REFACCION', true],
    ['TERMINADO', false],
    ['ENTREGADO', false]
  ])('test_datos_basicos_y_reasignacion_en_%s_%s', (estado, esperado) => {
    expect(isBasicDataEditable(estado)).toBe(esperado);
  });

  test('test_solo_el_administrador_y_el_mecanico_asignado_editan_el_trabajo', () => {
    const o = orden('EN_REPARACION');
    expect(canEditWork(admin, o)).toBe(true);
    expect(canEditWork(asignado, o)).toBe(true);
    expect(canEditWork(ajeno, o)).toBe(false);
    expect(canEditWork(recepcion, o)).toBe(false);
  });
});
