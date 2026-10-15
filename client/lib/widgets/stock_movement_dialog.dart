import 'package:flutter/material.dart';

import '../models/part.dart';
import '../utils/app_theme.dart';
import '../utils/validators.dart';

/// Tipo de operación manual sobre la existencia.
enum StockOperation { entry, adjustment }

/// Datos capturados en el diálogo: la cantidad recibida (entrada) o la existencia contada (ajuste).
class StockMovementInput {
  const StockMovementInput({required this.value, required this.reason});

  final int value;
  final String reason;
}

/// Diálogo para registrar una entrada de mercancía o un ajuste por conteo físico.
/// Devuelve los datos o null si se cancela. El motivo es obligatorio en ambos casos.
Future<StockMovementInput?> showStockMovementDialog(
  BuildContext context, {
  required StockOperation operation,
  required Part part,
}) {
  return showDialog<StockMovementInput>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _StockMovementDialog(operation: operation, part: part),
  );
}

class _StockMovementDialog extends StatefulWidget {
  const _StockMovementDialog({required this.operation, required this.part});

  final StockOperation operation;
  final Part part;

  @override
  State<_StockMovementDialog> createState() => _StockMovementDialogState();
}

class _StockMovementDialogState extends State<_StockMovementDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _value = TextEditingController();
  final TextEditingController _reason = TextEditingController();

  bool get _isEntry => widget.operation == StockOperation.entry;

  @override
  void dispose() {
    _value.dispose();
    _reason.dispose();
    super.dispose();
  }

  /// Diferencia que se registrará con el ajuste, para mostrarla antes de guardar.
  int? get _difference {
    final int? contada = int.tryParse(_value.text.trim());
    return contada == null ? null : contada - widget.part.stock;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(StockMovementInput(
      value: int.parse(_value.text.trim()),
      reason: _reason.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final int? diferencia = _isEntry ? null : _difference;
    return AlertDialog(
      title: Text(_isEntry ? 'Registrar entrada' : 'Ajustar existencia'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          onChanged: () => setState(() {}),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text('${widget.part.code} · ${widget.part.name}', style: text.bodyLarge),
              const SizedBox(height: AppSpacing.xs),
              Text('Existencia actual: ${widget.part.stock}', style: text.bodySmall),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _value,
                autofocus: true,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: _isEntry ? 'Cantidad recibida *' : 'Existencia contada *',
                ),
                validator: (String? v) => _isEntry
                    ? Validators.quantity(v, 'la cantidad recibida')
                    : Validators.stock(v, 'la existencia contada'),
              ),
              if (!_isEntry) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  diferencia == null
                      ? 'Indica la existencia real contada en el almacén.'
                      : diferencia == 0
                          ? 'Sin diferencia: la existencia ya es esa cantidad.'
                          : 'Diferencia: ${diferencia > 0 ? '+' : ''}$diferencia',
                  style: text.bodySmall,
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _reason,
                decoration: InputDecoration(
                  labelText: 'Motivo *',
                  helperText: _isEntry ? 'Por ejemplo: compra a proveedor.' : 'Por ejemplo: conteo físico.',
                ),
                validator: (String? v) =>
                    Validators.required(v, 'el motivo') ?? Validators.maxLength(v, 255),
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
