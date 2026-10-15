import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../utils/format.dart';
import '../utils/validators.dart';

/// Campo de fecha y hora de pared (`YYYY-MM-DDTHH:mm`) con los selectores nativos de Material.
/// Valida que sea futura y dentro de un año, como exige la API.
class DateTimeFormField extends StatelessWidget {
  const DateTimeFormField({
    super.key,
    required this.value,
    required this.onChanged,
    this.label = 'Fecha y hora *',
    this.enabled = true,
    this.errorText,
  });

  /// Valor actual en formato `YYYY-MM-DDTHH:mm`, o null si no se ha elegido.
  final String? value;
  final ValueChanged<String?> onChanged;
  final String label;
  final bool enabled;
  final String? errorText;

  static String _two(int n) => n.toString().padLeft(2, '0');

  Future<void> _pick(BuildContext context) async {
    final DateTime ahora = DateTime.now();
    final DateTime inicial = DateTime.tryParse(value ?? '') ?? ahora.add(const Duration(days: 1));
    final DateTime? dia = await showDatePicker(
      context: context,
      initialDate: inicial.isBefore(ahora) ? ahora : inicial,
      firstDate: DateTime(ahora.year, ahora.month, ahora.day),
      lastDate: ahora.add(const Duration(days: 365)),
      helpText: 'Elige la fecha',
      cancelText: 'Cancelar',
      confirmText: 'Aceptar',
    );
    if (dia == null || !context.mounted) return;
    final TimeOfDay? hora = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(inicial),
      helpText: 'Elige la hora',
      cancelText: 'Cancelar',
      confirmText: 'Aceptar',
    );
    if (hora == null) return;
    onChanged(
      '${dia.year}-${_two(dia.month)}-${_two(dia.day)}T${_two(hora.hour)}:${_two(hora.minute)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      // La clave recrea el campo cuando cambia el valor, sin tocar un controlador durante la construcción.
      key: ValueKey<String?>(value),
      initialValue: value == null ? '' : Format.dateTime(value),
      readOnly: true,
      enabled: enabled,
      onTap: enabled ? () => _pick(context) : null,
      decoration: InputDecoration(
        labelText: label,
        errorText: errorText,
        suffixIcon: const Icon(LucideIcons.calendarDays, size: 18),
      ),
      validator: (_) => Validators.futureDateTime(value),
    );
  }
}
