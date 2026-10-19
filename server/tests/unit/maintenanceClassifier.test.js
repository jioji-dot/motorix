import { classify, compareByUrgency, hoyLocal, urgency } from '../../services/maintenanceClassifier.js';

const HOY = '2026-10-19';

describe('Clasificación de mantenimientos: fechas', () => {
  const con = (nextDate) => classify({ nextDate, nextMileage: null }, 50000, HOY);

  test('una_fecha_de_ayer_esta_vencida', () => {
    expect(con('2026-10-18')).toEqual({ classification: 'VENCIDO', daysLeft: -1, kmLeft: null });
  });

  test('una_fecha_de_hoy_es_proxima_y_no_vencida', () => {
    expect(con('2026-10-19')).toEqual({ classification: 'PROXIMO', daysLeft: 0, kmLeft: null });
  });

  test('a_15_dias_es_proximo', () => {
    expect(con('2026-11-03')).toMatchObject({ classification: 'PROXIMO', daysLeft: 15 });
  });

  test('a_16_dias_es_normal', () => {
    expect(con('2026-11-04')).toMatchObject({ classification: 'NORMAL', daysLeft: 16 });
  });

  test('cuenta_bien_el_cambio_de_mes_y_de_anio', () => {
    expect(classify({ nextDate: '2027-01-04' }, 0, '2026-12-19')).toMatchObject({ classification: 'NORMAL', daysLeft: 16 });
    expect(classify({ nextDate: '2027-01-03' }, 0, '2026-12-19')).toMatchObject({ classification: 'PROXIMO', daysLeft: 15 });
  });

  test('acepta_objetos_Date_de_la_base_de_datos', () => {
    expect(classify({ nextDate: new Date(2026, 9, 25) }, 0, HOY)).toMatchObject({ classification: 'PROXIMO', daysLeft: 6 });
  });
});

describe('Clasificación de mantenimientos: kilometraje', () => {
  const con = (nextMileage, actual = 50000) => classify({ nextDate: null, nextMileage }, actual, HOY);

  test('con_501_km_por_recorrer_es_normal', () => {
    expect(con(50501)).toEqual({ classification: 'NORMAL', daysLeft: null, kmLeft: 501 });
  });

  test('con_500_km_por_recorrer_es_proximo', () => {
    expect(con(50500)).toMatchObject({ classification: 'PROXIMO', kmLeft: 500 });
  });

  test('con_1_km_por_recorrer_es_proximo', () => {
    expect(con(50001)).toMatchObject({ classification: 'PROXIMO', kmLeft: 1 });
  });

  test('al_alcanzar_el_kilometraje_esta_vencido', () => {
    expect(con(50000)).toMatchObject({ classification: 'VENCIDO', kmLeft: 0 });
  });

  test('al_superar_el_kilometraje_esta_vencido_con_valor_negativo', () => {
    expect(con(49000)).toMatchObject({ classification: 'VENCIDO', kmLeft: -1000 });
  });
});

describe('Clasificación de mantenimientos: fecha y kilometraje juntos', () => {
  test('gana_la_condicion_mas_urgente_vencido_por_km_aunque_la_fecha_sea_lejana', () => {
    expect(classify({ nextDate: '2027-06-01', nextMileage: 49000 }, 50000, HOY)).toMatchObject({
      classification: 'VENCIDO',
      daysLeft: expect.any(Number),
      kmLeft: -1000,
    });
  });

  test('gana_la_fecha_vencida_aunque_falte_mucho_kilometraje', () => {
    expect(classify({ nextDate: '2026-10-01', nextMileage: 90000 }, 50000, HOY).classification).toBe('VENCIDO');
  });

  test('es_proximo_si_solo_una_de_las_dos_condiciones_esta_cerca', () => {
    expect(classify({ nextDate: '2026-12-31', nextMileage: 50300 }, 50000, HOY).classification).toBe('PROXIMO');
    expect(classify({ nextDate: '2026-10-25', nextMileage: 90000 }, 50000, HOY).classification).toBe('PROXIMO');
  });

  test('es_normal_si_ambas_estan_lejos', () => {
    expect(classify({ nextDate: '2027-03-01', nextMileage: 60000 }, 50000, HOY).classification).toBe('NORMAL');
  });
});

describe('Orden por urgencia', () => {
  const m = (id, nextDate, nextMileage, actual = 50000) => ({ id, ...classify({ nextDate, nextMileage }, actual, HOY) });

  test('ordena_vencido_proximo_normal', () => {
    const lista = [m(1, '2027-03-01', null), m(2, '2026-10-25', null), m(3, '2026-10-01', null)];
    expect(lista.sort(compareByUrgency).map((x) => x.id)).toEqual([3, 2, 1]);
  });

  test('dentro_de_un_grupo_el_mas_urgente_va_primero', () => {
    const lista = [m(1, '2026-10-30', null), m(2, '2026-10-22', null), m(3, null, 50100)];
    // 3 días, 11 días y 100 km (≈ 2 días): el kilometraje es el más urgente.
    expect(lista.sort(compareByUrgency).map((x) => x.id)).toEqual([3, 2, 1]);
  });

  test('el_vencido_hace_mas_tiempo_va_primero_y_los_empates_se_desempatan_por_id', () => {
    const lista = [m(5, '2026-10-17', null), m(4, '2026-10-01', null), m(7, '2026-10-17', null)];
    expect(lista.sort(compareByUrgency).map((x) => x.id)).toEqual([4, 5, 7]);
  });

  test('la_urgencia_sin_valores_es_infinita', () => {
    expect(urgency({ daysLeft: null, kmLeft: null })).toBe(Infinity);
  });
});

describe('hoyLocal', () => {
  test('da_la_fecha_local_con_ceros_a_la_izquierda', () => {
    expect(hoyLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
