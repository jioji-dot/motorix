// Pruebas unitarias de la clasificación de mantenimientos (D4).
import { MAINTENANCE_CLASSIFICATION as C, MAINTENANCE_STATUS } from '../../config/constants.js';
import { classifyMaintenance, remaining } from '../../utils/maintenanceStatus.js';

const HOY = '2026-10-14';
const base = { currentMileage: 20000, today: HOY, warningDays: 30, warningKm: 1000 };
const clasificar = (datos) => classifyMaintenance({ ...base, ...datos });

describe('classifyMaintenance por fecha', () => {
  test('test_fecha_anterior_a_hoy_es_vencido', () => {
    expect(clasificar({ nextDate: '2026-10-13', nextMileage: null })).toBe(C.OVERDUE);
  });

  test('test_fecha_de_hoy_es_proximo', () => {
    expect(clasificar({ nextDate: HOY, nextMileage: null })).toBe(C.UPCOMING);
  });

  test('test_fecha_dentro_del_umbral_es_proximo_y_en_el_limite_tambien', () => {
    expect(clasificar({ nextDate: '2026-10-20', nextMileage: null })).toBe(C.UPCOMING);
    expect(clasificar({ nextDate: '2026-11-13', nextMileage: null })).toBe(C.UPCOMING);
  });

  test('test_fecha_mas_alla_del_umbral_es_lejano', () => {
    expect(clasificar({ nextDate: '2026-11-14', nextMileage: null })).toBe(C.LATER);
  });
});

describe('classifyMaintenance por kilometraje', () => {
  test('test_kilometraje_actual_mayor_al_objetivo_es_vencido', () => {
    expect(clasificar({ nextDate: null, nextMileage: 19999 })).toBe(C.OVERDUE);
  });

  test('test_kilometraje_igual_al_actual_es_proximo', () => {
    expect(clasificar({ nextDate: null, nextMileage: 20000 })).toBe(C.UPCOMING);
  });

  test('test_kilometraje_dentro_del_umbral_es_proximo_y_en_el_limite_tambien', () => {
    expect(clasificar({ nextDate: null, nextMileage: 20500 })).toBe(C.UPCOMING);
    expect(clasificar({ nextDate: null, nextMileage: 21000 })).toBe(C.UPCOMING);
  });

  test('test_kilometraje_mas_alla_del_umbral_es_lejano', () => {
    expect(clasificar({ nextDate: null, nextMileage: 21001 })).toBe(C.LATER);
  });
});

describe('classifyMaintenance con fecha y kilometraje', () => {
  test('test_basta_que_se_cumpla_uno_para_estar_vencido', () => {
    expect(clasificar({ nextDate: '2027-06-01', nextMileage: 19000 })).toBe(C.OVERDUE);
    expect(clasificar({ nextDate: '2026-10-01', nextMileage: 30000 })).toBe(C.OVERDUE);
  });

  test('test_basta_que_uno_este_dentro_del_umbral_para_ser_proximo', () => {
    expect(clasificar({ nextDate: '2027-06-01', nextMileage: 20800 })).toBe(C.UPCOMING);
    expect(clasificar({ nextDate: '2026-10-25', nextMileage: 30000 })).toBe(C.UPCOMING);
  });

  test('test_es_lejano_solo_si_ambos_estan_lejos', () => {
    expect(clasificar({ nextDate: '2027-06-01', nextMileage: 30000 })).toBe(C.LATER);
  });

  test('test_los_umbrales_configurables_cambian_el_resultado', () => {
    const datos = { nextDate: '2026-11-20', nextMileage: null };
    expect(clasificar({ ...datos, warningDays: 30 })).toBe(C.LATER);
    expect(clasificar({ ...datos, warningDays: 60 })).toBe(C.UPCOMING);
  });
});

describe('classifyMaintenance con estado cerrado', () => {
  test('test_un_mantenimiento_no_pendiente_no_tiene_clasificacion', () => {
    for (const status of [MAINTENANCE_STATUS.DONE, MAINTENANCE_STATUS.CANCELLED]) {
      expect(clasificar({ status, nextDate: '2020-01-01', nextMileage: 1 })).toBeNull();
    }
  });
});

describe('remaining', () => {
  test('test_dias_y_kilometros_restantes_son_negativos_al_vencer', () => {
    expect(remaining({ ...base, nextDate: '2026-10-10', nextMileage: 19500 })).toEqual({
      daysRemaining: -4,
      kmRemaining: -500
    });
  });

  test('test_dias_y_kilometros_restantes_positivos', () => {
    expect(remaining({ ...base, nextDate: '2026-10-24', nextMileage: 20800 })).toEqual({
      daysRemaining: 10,
      kmRemaining: 800
    });
  });

  test('test_devuelve_null_cuando_no_hay_ese_dato', () => {
    expect(remaining({ ...base, nextDate: null, nextMileage: 21000 })).toEqual({
      daysRemaining: null,
      kmRemaining: 1000
    });
    expect(remaining({ ...base, nextDate: '2026-10-15', nextMileage: null })).toEqual({
      daysRemaining: 1,
      kmRemaining: null
    });
  });

  test('test_acepta_fechas_como_objeto_date_y_cruza_cambios_de_mes_y_anio', () => {
    const datos = {
      ...base,
      today: new Date(2026, 11, 30),
      nextDate: new Date(2027, 0, 2),
      nextMileage: null
    };
    expect(remaining(datos).daysRemaining).toBe(3);
  });
});
