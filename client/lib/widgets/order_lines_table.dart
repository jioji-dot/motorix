import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../models/service_order.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../utils/validators.dart';

/// Contenedor que ocupa todo el ancho y desplaza la tabla en horizontal si no cabe
/// (por ejemplo, con descripciones largas en una ventana angosta).
class _ScrollableTable extends StatelessWidget {
  const _ScrollableTable({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: constraints.maxWidth),
          child: child,
        ),
      ),
    );
  }
}

/// Tabla de servicios realizados. Con [editable] muestra acciones para agregar, editar y quitar.
class ServicesTable extends StatelessWidget {
  const ServicesTable({
    super.key,
    required this.services,
    required this.editable,
    required this.onAdd,
    required this.onEdit,
    required this.onRemove,
  });

  final List<OrderServiceLine> services;
  final bool editable;
  final VoidCallback onAdd;
  final ValueChanged<OrderServiceLine> onEdit;
  final ValueChanged<OrderServiceLine> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (services.isEmpty)
          Text('Aún no hay servicios registrados.', style: Theme.of(context).textTheme.bodySmall)
        else
          _ScrollableTable(
            child: DataTable(
              showCheckboxColumn: false,
              columns: <DataColumn>[
                const DataColumn(label: Text('Descripción')),
                const DataColumn(label: Text('Importe'), numeric: true),
                if (editable) const DataColumn(label: Text('Acciones')),
              ],
              rows: <DataRow>[
                for (final OrderServiceLine s in services)
                  DataRow(cells: <DataCell>[
                    DataCell(Text(s.description)),
                    DataCell(Text(Format.money(s.amount))),
                    if (editable)
                      DataCell(_LineActions(
                        onEdit: () => onEdit(s),
                        onRemove: () => onRemove(s),
                      )),
                  ]),
              ],
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
                label: const Text('Agregar servicio'),
              ),
            ),
          ),
      ],
    );
  }
}

/// Tabla de mano de obra. Con [editable] muestra acciones para agregar, editar y quitar.
class LaborTable extends StatelessWidget {
  const LaborTable({
    super.key,
    required this.labor,
    required this.editable,
    required this.onAdd,
    required this.onEdit,
    required this.onRemove,
  });

  final List<OrderLaborLine> labor;
  final bool editable;
  final VoidCallback onAdd;
  final ValueChanged<OrderLaborLine> onEdit;
  final ValueChanged<OrderLaborLine> onRemove;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (labor.isEmpty)
          Text('Aún no hay mano de obra registrada.', style: Theme.of(context).textTheme.bodySmall)
        else
          _ScrollableTable(
            child: DataTable(
              showCheckboxColumn: false,
              columns: <DataColumn>[
                const DataColumn(label: Text('Descripción')),
                const DataColumn(label: Text('Horas'), numeric: true),
                const DataColumn(label: Text('Tarifa por hora'), numeric: true),
                const DataColumn(label: Text('Importe'), numeric: true),
                if (editable) const DataColumn(label: Text('Acciones')),
              ],
              rows: <DataRow>[
                for (final OrderLaborLine l in labor)
                  DataRow(cells: <DataCell>[
                    DataCell(Text(l.description)),
                    DataCell(Text(l.hours.toStringAsFixed(2))),
                    DataCell(Text(Format.money(l.hourlyRate))),
                    DataCell(Text(Format.money(l.amount))),
                    if (editable)
                      DataCell(_LineActions(
                        onEdit: () => onEdit(l),
                        onRemove: () => onRemove(l),
                      )),
                  ]),
              ],
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
                label: const Text('Agregar mano de obra'),
              ),
            ),
          ),
      ],
    );
  }
}

class _LineActions extends StatelessWidget {
  const _LineActions({required this.onEdit, required this.onRemove});

  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        IconButton(
          tooltip: 'Editar',
          icon: const Icon(LucideIcons.pencil, size: 18),
          onPressed: onEdit,
        ),
        IconButton(
          tooltip: 'Quitar',
          icon: const Icon(LucideIcons.trash2, size: 18),
          onPressed: onRemove,
        ),
      ],
    );
  }
}

/// Diálogo para agregar o editar un servicio. Devuelve los datos o null si se cancela.
Future<ServiceInput?> showServiceDialog(BuildContext context, {OrderServiceLine? existing}) {
  return showDialog<ServiceInput>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _ServiceDialog(existing: existing),
  );
}

class _ServiceDialog extends StatefulWidget {
  const _ServiceDialog({this.existing});

  final OrderServiceLine? existing;

  @override
  State<_ServiceDialog> createState() => _ServiceDialogState();
}

class _ServiceDialogState extends State<_ServiceDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _description;
  late final TextEditingController _amount;

  @override
  void initState() {
    super.initState();
    _description = TextEditingController(text: widget.existing?.description ?? '');
    _amount = TextEditingController(
      text: widget.existing == null ? '' : widget.existing!.amount.toStringAsFixed(2),
    );
  }

  @override
  void dispose() {
    _description.dispose();
    _amount.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(ServiceInput(
      description: _description.text.trim(),
      amount: Validators.parseDecimal(_amount.text)!,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.existing == null ? 'Agregar servicio' : 'Editar servicio'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _description,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Descripción *'),
                validator: Validators.description,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _amount,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Importe *'),
                validator: (String? v) => Validators.amount(v, 'el importe'),
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

/// Diálogo para agregar o editar mano de obra. Devuelve los datos o null si se cancela.
Future<LaborInput?> showLaborDialog(BuildContext context, {OrderLaborLine? existing}) {
  return showDialog<LaborInput>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => _LaborDialog(existing: existing),
  );
}

class _LaborDialog extends StatefulWidget {
  const _LaborDialog({this.existing});

  final OrderLaborLine? existing;

  @override
  State<_LaborDialog> createState() => _LaborDialogState();
}

class _LaborDialogState extends State<_LaborDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _description;
  late final TextEditingController _hours;
  late final TextEditingController _rate;

  @override
  void initState() {
    super.initState();
    final OrderLaborLine? l = widget.existing;
    _description = TextEditingController(text: l?.description ?? '');
    _hours = TextEditingController(text: l == null ? '' : l.hours.toStringAsFixed(2));
    _rate = TextEditingController(text: l == null ? '' : l.hourlyRate.toStringAsFixed(2));
  }

  @override
  void dispose() {
    _description.dispose();
    _hours.dispose();
    _rate.dispose();
    super.dispose();
  }

  /// Importe estimado mientras se captura (igual al que calcula el servidor).
  double? get _preview {
    final double? horas = Validators.parseDecimal(_hours.text);
    final double? tarifa = Validators.parseDecimal(_rate.text);
    if (horas == null || tarifa == null) return null;
    return LaborInput(description: '', hours: horas, hourlyRate: tarifa).amount;
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(LaborInput(
      description: _description.text.trim(),
      hours: Validators.parseDecimal(_hours.text)!,
      hourlyRate: Validators.parseDecimal(_rate.text)!,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final double? importe = _preview;
    return AlertDialog(
      title: Text(widget.existing == null ? 'Agregar mano de obra' : 'Editar mano de obra'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          onChanged: () => setState(() {}),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _description,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Descripción *'),
                validator: Validators.description,
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: TextFormField(
                      controller: _hours,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Horas *'),
                      validator: Validators.hours,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(
                    child: TextFormField(
                      controller: _rate,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Tarifa por hora *'),
                      validator: (String? v) => Validators.amount(v, 'la tarifa por hora'),
                      onFieldSubmitted: (_) => _submit(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                importe == null ? 'Importe: —' : 'Importe: ${Format.money(importe)}',
                style: Theme.of(context).textTheme.bodyLarge,
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
