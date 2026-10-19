// Prueba EXHAUSTIVA de la máquina de estados de la orden (CA-8 y SC-003):
// las 7 × 7 combinaciones de estado actual y destino, con cada tipo de usuario.
// La tabla esperada se escribe aparte (sin reutilizar la del módulo) para que la prueba sea independiente.
import { allowedTransitions, canTransition, transitionExists } from '../../services/orderStateMachine.js';

const ESTADOS = ['RECIBIDO', 'DIAGNOSTICO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'TERMINADO', 'ENTREGADO', 'CANCELADA'];

// Transiciones válidas y quién las aplica (research.md, sección 1).
const TRABAJO = [
  ['RECIBIDO', 'DIAGNOSTICO'],
  ['DIAGNOSTICO', 'EN_REPARACION'],
  ['EN_REPARACION', 'ESPERANDO_REFACCION'],
  ['EN_REPARACION', 'TERMINADO'],
  ['ESPERANDO_REFACCION', 'EN_REPARACION'],
]; // mecánico asignado o ADMIN
const GESTION = [
  ['RECIBIDO', 'CANCELADA'],
  ['DIAGNOSTICO', 'CANCELADA'],
  ['EN_REPARACION', 'CANCELADA'],
  ['ESPERANDO_REFACCION', 'CANCELADA'],
  ['TERMINADO', 'ENTREGADO'],
]; // RECEPTIONIST o ADMIN

const esPar = (lista, de, a) => lista.some(([x, y]) => x === de && y === a);

const ORDEN = (status) => ({ status, mechanicId: 3 });
const USUARIOS = {
  admin: { id: 1, role: 'ADMIN' },
  recepcion: { id: 2, role: 'RECEPTIONIST' },
  mecanicoAsignado: { id: 3, role: 'MECHANIC' },
  mecanicoAjeno: { id: 4, role: 'MECHANIC' },
};

function esperado(nombre, de, a) {
  if (esPar(TRABAJO, de, a)) return nombre === 'admin' || nombre === 'mecanicoAsignado';
  if (esPar(GESTION, de, a)) return nombre === 'admin' || nombre === 'recepcion';
  return false;
}

describe('orderStateMachine: las 49 combinaciones de estado × los 4 tipos de usuario', () => {
  const casos = [];
  for (const de of ESTADOS) {
    for (const a of ESTADOS) {
      for (const nombre of Object.keys(USUARIOS)) casos.push([de, a, nombre]);
    }
  }

  test('hay_196_combinaciones_cubiertas', () => {
    expect(casos).toHaveLength(7 * 7 * 4);
  });

  test.each(casos)('%s → %s con %s', (de, a, nombre) => {
    expect(canTransition(de, a, USUARIOS[nombre], ORDEN(de))).toBe(esperado(nombre, de, a));
  });
});

describe('orderStateMachine.transitionExists', () => {
  test.each(ESTADOS.flatMap((de) => ESTADOS.map((a) => [de, a])))('%s → %s', (de, a) => {
    expect(transitionExists(de, a)).toBe(esPar(TRABAJO, de, a) || esPar(GESTION, de, a));
  });

  test('un_estado_no_puede_pasar_a_si_mismo', () => {
    for (const estado of ESTADOS) expect(transitionExists(estado, estado)).toBe(false);
  });

  test('entregado_y_cancelada_no_tienen_salidas', () => {
    for (const final of ['ENTREGADO', 'CANCELADA']) {
      for (const destino of ESTADOS) expect(transitionExists(final, destino)).toBe(false);
    }
  });

  test('ignora_estados_desconocidos', () => {
    expect(transitionExists('INVENTADO', 'RECIBIDO')).toBe(false);
    expect(transitionExists('RECIBIDO', 'INVENTADO')).toBe(false);
  });
});

describe('orderStateMachine.allowedTransitions', () => {
  const permitidas = (status, nombre) => allowedTransitions(ORDEN(status), USUARIOS[nombre]).sort();

  test('el_mecanico_asignado_solo_ve_los_avances_del_trabajo', () => {
    expect(permitidas('RECIBIDO', 'mecanicoAsignado')).toEqual(['DIAGNOSTICO']);
    expect(permitidas('DIAGNOSTICO', 'mecanicoAsignado')).toEqual(['EN_REPARACION']);
    expect(permitidas('EN_REPARACION', 'mecanicoAsignado')).toEqual(['ESPERANDO_REFACCION', 'TERMINADO']);
    expect(permitidas('ESPERANDO_REFACCION', 'mecanicoAsignado')).toEqual(['EN_REPARACION']);
    expect(permitidas('TERMINADO', 'mecanicoAsignado')).toEqual([]);
  });

  test('recepcion_solo_ve_cancelar_y_entregar', () => {
    expect(permitidas('RECIBIDO', 'recepcion')).toEqual(['CANCELADA']);
    expect(permitidas('EN_REPARACION', 'recepcion')).toEqual(['CANCELADA']);
    expect(permitidas('TERMINADO', 'recepcion')).toEqual(['ENTREGADO']);
  });

  test('el_administrador_ve_la_union_de_ambos_conjuntos', () => {
    expect(permitidas('EN_REPARACION', 'admin')).toEqual(['CANCELADA', 'ESPERANDO_REFACCION', 'TERMINADO']);
    expect(permitidas('TERMINADO', 'admin')).toEqual(['ENTREGADO']);
  });

  test('un_mecanico_ajeno_no_ve_ninguna_transicion', () => {
    for (const estado of ESTADOS) expect(permitidas(estado, 'mecanicoAjeno')).toEqual([]);
  });

  test('las_ordenes_entregadas_o_canceladas_no_tienen_transiciones_para_nadie', () => {
    for (const final of ['ENTREGADO', 'CANCELADA']) {
      for (const nombre of Object.keys(USUARIOS)) expect(permitidas(final, nombre)).toEqual([]);
    }
  });
});
