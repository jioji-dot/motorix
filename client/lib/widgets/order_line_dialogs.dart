import 'package:flutter/material.dart';

import '../models/service_order.dart';
import '../utils/app_theme.dart';

const double _importeMaximo = 99999999.99;

/// Valida un importe monetario con la misma regla del servidor: entre [minimo] y [maximo], hasta dos decimales.
String? _validarImporte(
  String? valor, {
  required String etiqueta,
  double minimo = 0,
  double maximo = _importeMaximo,
  String? textoMaximo,
}) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return '$etiqueta es obligatorio.';
  final numero = double.tryParse(texto);
  if (numero == null) return '$etiqueta no es válido.';
  if (numero < minimo) return '$etiqueta no puede ser menor a ${_formatoLimite(minimo)}.';
  if (numero > maximo) return '$etiqueta no puede ser mayor a ${textoMaximo ?? _formatoLimite(maximo)}.';
  if ((numero * 100 - (numero * 100).roundToDouble()).abs() > 1e-6) return '$etiqueta puede tener hasta dos decimales.';
  return null;
}

String _formatoLimite(double valor) => valor == valor.roundToDouble() ? valor.toInt().toString() : valor.toString();

String? _validarDescripcion(String? valor) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return 'La descripción es obligatoria.';
  if (texto.length > 255) return 'La descripción no puede tener más de 255 caracteres.';
  return null;
}

/// Diálogo para agregar o editar un servicio realizado. Devuelve `{description, amount}` o `null` si se cancela.
Future<Map<String, dynamic>?> showServiceDialog(BuildContext context, {OrderService? service}) {
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (_) => _LineDialog(
      title: service == null ? 'Agregar servicio' : 'Editar servicio',
      initialDescription: service?.description,
      campos: [
        _CampoLinea(
          clave: 'amount',
          llave: 'campo-importe',
          etiqueta: 'Importe',
          inicial: service?.amount,
          validador: (v) => _validarImporte(v, etiqueta: 'El importe', textoMaximo: '99,999,999.99'),
        ),
      ],
    ),
  );
}

/// Diálogo para agregar o editar mano de obra. Devuelve `{description, hours, hourlyRate}` o `null` si se cancela.
Future<Map<String, dynamic>?> showLaborDialog(BuildContext context, {OrderLabor? labor}) {
  return showDialog<Map<String, dynamic>>(
    context: context,
    builder: (_) => _LineDialog(
      title: labor == null ? 'Agregar mano de obra' : 'Editar mano de obra',
      initialDescription: labor?.description,
      campos: [
        _CampoLinea(
          clave: 'hours',
          llave: 'campo-horas',
          etiqueta: 'Horas',
          inicial: labor?.hours,
          validador: (v) => _validarImporte(v, etiqueta: 'El número de horas', minimo: 0.01, maximo: 999.99),
        ),
        _CampoLinea(
          clave: 'hourlyRate',
          llave: 'campo-tarifa',
          etiqueta: 'Tarifa por hora',
          inicial: labor?.hourlyRate,
          validador: (v) => _validarImporte(v, etiqueta: 'El valor de la tarifa por hora', textoMaximo: '99,999,999.99'),
        ),
      ],
    ),
  );
}

class _CampoLinea {
  const _CampoLinea({
    required this.clave,
    required this.llave,
    required this.etiqueta,
    required this.validador,
    this.inicial,
  });

  final String clave;
  final String llave;
  final String etiqueta;
  final String? inicial;
  final String? Function(String?) validador;
}

class _LineDialog extends StatefulWidget {
  const _LineDialog({required this.title, required this.campos, this.initialDescription});

  final String title;
  final String? initialDescription;
  final List<_CampoLinea> campos;

  @override
  State<_LineDialog> createState() => _LineDialogState();
}

class _LineDialogState extends State<_LineDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _description;
  late final Map<String, TextEditingController> _controllers;

  @override
  void initState() {
    super.initState();
    _description = TextEditingController(text: widget.initialDescription ?? '');
    _controllers = {
      for (final campo in widget.campos) campo.clave: TextEditingController(text: campo.inicial ?? ''),
    };
  }

  @override
  void dispose() {
    _description.dispose();
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _guardar() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(<String, dynamic>{
      'description': _description.text.trim(),
      for (final campo in widget.campos) campo.clave: double.parse(_controllers[campo.clave]!.text.trim()),
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  key: const Key('campo-descripcion'),
                  controller: _description,
                  autofocus: true,
                  decoration: const InputDecoration(labelText: 'Descripción'),
                  validator: _validarDescripcion,
                ),
                for (final campo in widget.campos) ...[
                  const SizedBox(height: AppSpacing.lg),
                  TextFormField(
                    key: Key(campo.llave),
                    controller: _controllers[campo.clave],
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: campo.etiqueta),
                    validator: campo.validador,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _guardar, child: const Text('Guardar')),
      ],
    );
  }
}

/// Valida el kilometraje del servicio (opcional): entero entre el de entrada y 1,500,000 km. Nulo si es válido o está vacío.
String? validarKilometrajeDelServicio(String? valor, int entryMileage) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return null;
  final numero = int.tryParse(texto);
  const maximo = 1500000;
  if (numero == null || numero < 0 || numero > maximo) {
    return 'Debe ser un número entero entre el kilometraje de entrada y 1,500,000 km.';
  }
  if (numero < entryMileage) return 'No puede ser menor al kilometraje de entrada ($entryMileage km).';
  return null;
}
