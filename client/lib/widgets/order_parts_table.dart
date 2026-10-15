import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/service_order.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../utils/validators.dart';

/// Tabla de refacciones utilizadas en la orden. Con [editable] ofrece agregar, cambiar la
/// cantidad y quitar; sin ello (recepción u orden cerrada) es de solo lectura.
class OrderPartsTable extends StatelessWidget {
  const OrderPartsTable({
    super.key,
    required this.parts,
    required this.editable,
    required this.onAdd,
    required this.onEditQuantity,
    required this.onRemove,
  });

  final List<OrderPartLine> parts;
  final bool editable;
  final VoidCallback onAdd;
  final ValueChanged<OrderPartLine> onEditQuantity;
  final ValueChanged<OrderPartLine> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (parts.isEmpty)
          Text('Aún no hay refacciones registradas.', style: Theme.of(context).textTheme.bodySmall)
        else
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) => SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: constraints.maxWidth),
                child: DataTable(
                  showCheckboxColumn: false,
                  columns: <DataColumn>[
                    const DataColumn(label: Text('Código')),
                    const DataColumn(label: Text('Refacción')),
                    const DataColumn(label: Text('Cantidad'), numeric: true),
                    const DataColumn(label: Text('Precio unitario'), numeric: true),
                    const DataColumn(label: Text('Importe'), numeric: true),
                    if (editable) const DataColumn(label: Text('Acciones')),
                  ],
                  rows: <DataRow>[
                    for (final OrderPartLine p in parts)
                      DataRow(cells: <DataCell>[
                        DataCell(Text(p.code)),
                        DataCell(Text(p.name)),
                        DataCell(Text('${p.quantity}')),
                        DataCell(Text(Format.money(p.unitPrice))),
                        DataCell(Text(Format.money(p.amount))),
                        if (editable)
                          DataCell(Row(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              IconButton(
                                tooltip: 'Cambiar cantidad',
                                icon: const Icon(LucideIcons.pencil, size: 18),
                                onPressed: () => onEditQuantity(p),
                              ),
                              IconButton(
                                tooltip: 'Quitar refacción',
                                icon: const Icon(LucideIcons.trash2, size: 18),
                                onPressed: () => onRemove(p),
                              ),
                            ],
                          )),
                      ]),
                  ],
                ),
              ),
            ),
          ),
        if (editable)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.md),
            child: Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: onAdd,
                icon: const Icon(LucideIcons.plus, size: 18),
                label: const Text('Agregar refacción'),
              ),
            ),
          ),
      ],
    );
  }
}

/// Diálogo para cambiar la cantidad de una refacción de la orden. Devuelve la cantidad nueva o
/// null si se cancela.
Future<int?> showPartQuantityDialog(BuildContext context, OrderPartLine linea) {
  return showDialog<int>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _QuantityDialog(linea: linea),
  );
}

class _QuantityDialog extends StatefulWidget {
  const _QuantityDialog({required this.linea});

  final OrderPartLine linea;

  @override
  State<_QuantityDialog> createState() => _QuantityDialogState();
}

class _QuantityDialogState extends State<_QuantityDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _quantity;

  @override
  void initState() {
    super.initState();
    _quantity = TextEditingController(text: '${widget.linea.quantity}');
  }

  @override
  void dispose() {
    _quantity.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(int.parse(_quantity.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cambiar cantidad'),
      content: SizedBox(
        width: 360,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text('${widget.linea.code} · ${widget.linea.name}'),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _quantity,
                autofocus: true,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cantidad *'),
                validator: Validators.quantity,
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
