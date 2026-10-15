import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/utils/validators.dart';

void main() {
  group('Validators.password', () {
    test('test_acepta_contrasena_que_cumple_la_politica', () {
      expect(Validators.password('Taller2026'), isNull);
    });

    test('test_rechaza_contrasenas_que_incumplen_la_politica', () {
      expect(Validators.password('Ab1cdef'), isNotNull, reason: 'menos de 8 caracteres');
      expect(Validators.password('taller2026'), isNotNull, reason: 'sin mayúscula');
      expect(Validators.password('TALLER2026'), isNotNull, reason: 'sin minúscula');
      expect(Validators.password('TallerMotor'), isNotNull, reason: 'sin número');
    });
  });

  group('Validators.phone', () {
    test('test_acepta_telefonos_con_formato_comun', () {
      expect(Validators.phone('5512345678'), isNull);
      expect(Validators.phone('+52 55 1234-5678'), isNull);
    });

    test('test_rechaza_telefono_vacio_corto_o_con_letras', () {
      expect(Validators.phone(''), isNotNull);
      expect(Validators.phone('12345'), isNotNull);
      expect(Validators.phone('55abc12345'), isNotNull);
    });
  });

  group('Validators.email', () {
    test('test_el_correo_opcional_vacio_es_valido', () {
      expect(Validators.email(''), isNull);
    });

    test('test_rechaza_correo_con_formato_invalido', () {
      expect(Validators.email('sin-arroba'), isNotNull);
      expect(Validators.email('ana@correo.com'), isNull);
    });

    test('test_el_correo_obligatorio_vacio_es_invalido', () {
      expect(Validators.email('', obligatorio: true), isNotNull);
    });
  });

  group('Validators vehículo', () {
    test('test_valida_la_placa', () {
      expect(Validators.licensePlate('abc-123'), isNull);
      expect(Validators.licensePlate(''), isNotNull);
      expect(Validators.licensePlate('AB*123'), isNotNull);
    });

    test('test_valida_el_vin_opcional', () {
      expect(Validators.vin(''), isNull);
      expect(Validators.vin('1HGCM82633A004352'), isNull);
      expect(Validators.vin('1HGCM82633A00435O'), isNotNull, reason: 'contiene la letra O');
      expect(Validators.vin('ABC'), isNotNull);
    });

    test('test_valida_el_rango_del_anio', () {
      expect(Validators.year('2020', anioActual: 2026), isNull);
      expect(Validators.year('2027', anioActual: 2026), isNull);
      expect(Validators.year('2028', anioActual: 2026), isNotNull);
      expect(Validators.year('1949', anioActual: 2026), isNotNull);
      expect(Validators.year('abc', anioActual: 2026), isNotNull);
    });

    test('test_valida_el_kilometraje_no_negativo', () {
      expect(Validators.mileage(''), isNull);
      expect(Validators.mileage('0'), isNull);
      expect(Validators.mileage('-5'), isNotNull);
      expect(Validators.mileage('12.5'), isNotNull);
    });
  });

  group('Validators.username', () {
    test('test_valida_longitud_y_caracteres_permitidos', () {
      expect(Validators.username('recepcion'), isNull);
      expect(Validators.username('ab'), isNotNull);
      expect(Validators.username('con espacio'), isNotNull);
    });
  });
}
