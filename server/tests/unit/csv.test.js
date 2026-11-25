// Escritura de CSV: BOM, comillas, saltos de línea y neutralización de fórmulas (Sprint 7, FR-016).
import { neutralizar, toCsv } from '../../utils/csv.js';

describe('toCsv', () => {
  test('empieza_con_bom_utf8_y_usa_saltos_de_linea_crlf', () => {
    const csv = toCsv(['A', 'B'], [[1, 2], [3, 4]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿A,B\r\n1,2\r\n3,4\r\n');
  });

  test('entrecomilla_los_campos_con_comas_comillas_y_saltos_de_linea', () => {
    const csv = toCsv(['Texto'], [['uno, dos'], ['dice "hola"'], ['línea 1\nlínea 2']]);
    expect(csv).toBe('﻿Texto\r\n"uno, dos"\r\n"dice ""hola"""\r\n"línea 1\nlínea 2"\r\n');
  });

  test('escribe_numeros_y_vacios_sin_texto_extra', () => {
    expect(toCsv(['N', 'M'], [[0, null], [1.5, undefined], ['12.50', '']])).toBe('﻿N,M\r\n0,\r\n1.5,\r\n12.50,\r\n');
  });

  test('sin_filas_solo_escribe_el_encabezado', () => {
    expect(toCsv(['A'], [])).toBe('﻿A\r\n');
  });

  test('conserva_los_acentos_y_la_enie', () => {
    expect(toCsv(['Año'], [['Reparación']])).toContain('Año\r\nReparación');
  });
});

describe('neutralizar (celdas que se podrían leer como fórmulas)', () => {
  test.each(['=1+1', '+SUMA(A1)', '-2+3', '@cmd', '\tcmd', '\rcmd', '=HYPERLINK("http://x")'])('antepone_un_apostrofo_a_%j', (valor) => {
    expect(neutralizar(valor)).toBe(`'${valor}`);
  });

  test.each(['Cambio de aceite', '12.50', '0', 'a=b', 'ok-ok', ''])('no_cambia_%j', (valor) => {
    expect(neutralizar(valor)).toBe(valor);
  });

  test('un_numero_negativo_real_no_se_toca', () => {
    expect(neutralizar(-5)).toBe(-5);
    expect(toCsv(['M'], [[-5.25]])).toBe('﻿M\r\n-5.25\r\n');
  });

  test('las_descripciones_con_formula_salen_neutralizadas_en_el_archivo', () => {
    expect(toCsv(['Descripción'], [['=CMD()']])).toBe("﻿Descripción\r\n'=CMD()\r\n");
  });
});
