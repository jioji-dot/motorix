import 'package:flutter/material.dart';

import '../models/service_order.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';

/// Diálogo para registrar el kilometraje con el que termina el servicio. Devuelve el valor o null
/// si se cancela. No puede ser menor al kilometraje de entrada de la orden.
Future<int?> showServiceMileageDialog(BuildContext context, ServiceOrder orden) {
  return showDialog<int>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _ServiceMileageDialog(orden: orden),
  );
}

class _ServiceMileageDialog extends StatefulWidget {
  const _ServiceMileageDialog({required this.orden});

  final ServiceOrder orden;

  @override
  State<_ServiceMileageDialog> createState() => _ServiceMileageDialogState();
}

class _ServiceMileageDialogState extends State<_ServiceMileageDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _mileage;

  @override
  void initState() {
    super.initState();
    _mileage = TextEditingController(text: widget.orden.serviceMileage?.toString() ?? '');
  }

  @override
  void dispose() {
    _mileage.dispose();
    super.dispose();
  }

  String? _validate(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return 'Ingresa el kilometraje de servicio.';
    final int? numero = int.tryParse(texto);
    if (numero == null || numero < 0) return 'El kilometraje debe ser un número entero no negativo.';
    if (numero < widget.orden.entryMileage) {
      return 'No puede ser menor al de entrada (${Format.mileage(widget.orden.entryMileage)}).';
    }
    return null;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(int.parse(_mileage.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Kilometraje de servicio'),
      content: SizedBox(
        width: 380,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                'Kilometraje de entrada: ${Format.mileage(widget.orden.entryMileage)}.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _mileage,
                autofocus: true,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Kilometraje de servicio *'),
                validator: _validate,
                onFieldSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
      ),
      actions: <Widget>[
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _submit, child: const Text('Guardar')),
      ],
    );
  }
}
