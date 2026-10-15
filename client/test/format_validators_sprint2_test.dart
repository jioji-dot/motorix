import 'package:flutter_test/flutter_test.dart';
import 'package:motorix_client/utils/format.dart';
import 'package:motorix_client/utils/validators.dart';

void main() {
  group('Format sprint 2', () {
    test('test_formatea_importes_con_separador_de_miles_y_dos_decimales', () {
      expect(Format.money(0), r'$0.00');
      expect(Format.money(5.5), r'$5.50');
      expect(Format.money(1234.5), r'$1,234.50');
      expect(Format.money(1234567.891), r'$1,234,567.89');
    });

    test('test_formatea_la_hora_local_de_pared', () {
      expect(Format.dateTime('2026-10-20T10:30'), '20/10/2026 10:30');
      expect(Format.dateTime(null), '—');
      expect(Format.dateTime('x'), '—');
    });
  });

  group('Validators sprint 2', () {
    test('test_descripcion_obligatoria_de_hasta_255_caracteres', () {
      expect(Validators.description('Cambio de aceite'), isNull);
      expect(Validators.description('  '), isNotNull);
      expect(Validators.description('a' * 256), isNotNull);
      expect(Validators.description('a' * 255), isNull);
    });

    test('test_importe_mayor_o_igual_a_cero_con_maximo_dos_decimales', () {
      expect(Validators.amount('0'), isNull);
      expect(Validators.amount('1250.50'), isNull);
      expect(Validators.amount('1250,5'), isNull);
      expect(Validators.amount(''), isNotNull);
      expect(Validators.amount('-5'), isNotNull);
      expect(Validators.amount('12.345'), isNotNull);
      expect(Validators.amount('abc'), isNotNull);
    });

    test('test_horas_mayores_a_cero_y_hasta_9999_99', () {
      expect(Validators.hours('1.5'), isNull);
      expect(Validators.hours('9999.99'), isNull);
      expect(Validators.hours('0'), isNotNull);
      expect(Validators.hours('10000'), isNotNull);
      expect(Validators.hours('2.555'), isNotNull);
      expect(Validators.hours(''), isNotNull);
    });

    test('test_convierte_decimales_con_punto_o_coma', () {
      expect(Validators.parseDecimal('12.5'), 12.5);
      expect(Validators.parseDecimal('12,5'), 12.5);
      expect(Validators.parseDecimal('x'), isNull);
    });

    test('test_la_cita_debe_ser_futura_y_dentro_de_un_anio', () {
      final DateTime ahora = DateTime(2026, 10, 12, 12, 0);
      expect(Validators.futureDateTime('2026-10-12T12:01', now: ahora), isNull);
      expect(Validators.futureDateTime('2026-10-12T12:00', now: ahora), isNotNull);
      expect(Validators.futureDateTime('2026-10-11T09:00', now: ahora), isNotNull);
      expect(Validators.futureDateTime('2027-10-12T12:00', now: ahora), isNull);
      expect(Validators.futureDateTime('2027-10-12T12:01', now: ahora), isNotNull);
      expect(Validators.futureDateTime(null, now: ahora), isNotNull);
      expect(Validators.futureDateTime('basura', now: ahora), isNotNull);
    });
  });
}
