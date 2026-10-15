import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/api_error.dart';
import '../models/maintenance.dart';
import '../providers/maintenance_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../utils/validators.dart';
import 'confirm_dialog.dart';
import 'state_views.dart';

/// Diálogo para programar o editar el próximo mantenimiento. Devuelve los datos o null si se
/// cancela. Se exige la fecha, el kilometraje o ambos. Con [existing] precarga sus datos.
Future<MaintenanceInput?> showMaintenanceDialog(
  BuildContext context, {
  Maintenance? existing,
  int? currentMileage,
}) {
  return showDialog<MaintenanceInput>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) =>
        _MaintenanceDialog(existing: existing, currentMileage: currentMileage ?? existing?.currentMileage),
  );
}

/// Registra el próximo mantenimiento desde una orden terminada o entregada: abre el diálogo,
/// guarda y, si el vehículo ya tiene uno pendiente, pide confirmar el reemplazo (el anterior
/// queda cancelado). Muestra el resultado y devuelve true si se registró.
Future<bool> registerNextMaintenance(
  BuildContext context, {
  required int orderId,
  required int currentMileage,
}) async {
  final MaintenanceInput? datos =
      await showMaintenanceDialog(context, currentMileage: currentMileage);
  if (datos == null || !context.mounted) return false;
  final MaintenanceProvider provider = context.read<MaintenanceProvider>();

  try {
    try {
      await provider.create(orderId, datos);
    } on ApiError catch (error) {
      if (error.code != 'MAINTENANCE_PENDING_EXISTS') rethrow;
      final dynamic detalles = error.details;
      final dynamic pendiente = detalles is Map ? detalles['pending'] : null;
      final String descripcion =
          pendiente is Map ? (pendiente['description'] as String? ?? 'el pendiente') : 'el pendiente';
      if (!context.mounted) return false;
      final bool reemplazar = await showConfirmDialog(
        context,
        title: 'Reemplazar mantenimiento pendiente',
        message: 'Este vehículo ya tiene un mantenimiento pendiente: "$descripcion". '
            '¿Quieres reemplazarlo? El anterior quedará cancelado.',
        confirmLabel: 'Reemplazar',
      );
      if (!reemplazar || !context.mounted) return false;
      await provider.create(orderId, datos, replacePending: true);
    }
    if (context.mounted) showAppSnackBar(context, 'Próximo mantenimiento registrado correctamente.');
    return true;
  } on ApiError catch (error) {
    if (context.mounted) showAppSnackBar(context, error.message, isError: true);
    return false;
  }
}

class _MaintenanceDialog extends StatefulWidget {
  const _MaintenanceDialog({this.existing, this.currentMileage});

  final Maintenance? existing;
  final int? currentMileage;

  @override
  State<_MaintenanceDialog> createState() => _MaintenanceDialogState();
}

class _MaintenanceDialogState extends State<_MaintenanceDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _description;
  late final TextEditingController _mileage;
  String? _date;
  String? _targetError;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final Maintenance? m = widget.existing;
    _description = TextEditingController(text: m?.description ?? '');
    _mileage = TextEditingController(text: m?.nextMileage?.toString() ?? '');
    _date = m?.nextDate;
  }

  @override
  void dispose() {
    _description.dispose();
    _mileage.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final DateTime hoy = DateTime.now();
    final DateTime inicio = DateTime(hoy.year, hoy.month, hoy.day);
    final DateTime? inicial = _date == null ? null : DateTime.tryParse(_date!);
    final DateTime? elegida = await showDatePicker(
      context: context,
      initialDate: (inicial != null && !inicial.isBefore(inicio)) ? inicial : inicio,
      firstDate: inicio,
      lastDate: DateTime(hoy.year + 10, hoy.month, hoy.day),
      helpText: 'Fecha del próximo mantenimiento',
      cancelText: 'Cancelar',
      confirmText: 'Aceptar',
    );
    if (elegida != null) {
      setState(() {
        _date = Format.isoDate(elegida);
        _targetError = null;
      });
    }
  }

  String? _validateMileage(String? valor) {
    final String texto = (valor ?? '').trim();
    if (texto.isEmpty) return null;
    final String? base = Validators.mileage(texto);
    if (base != null) return base;
    final int? actual = widget.currentMileage;
    if (actual != null && int.parse(texto) < actual) {
      return 'No puede ser menor al kilometraje actual (${Format.mileage(actual)}).';
    }
    return null;
  }

  void _submit() {
    final bool valido = _formKey.currentState?.validate() ?? false;
    final bool sinObjetivo = _date == null && _mileage.text.trim().isEmpty;
    setState(() => _targetError = sinObjetivo ? 'Indica la fecha, el kilometraje o ambos.' : null);
    if (!valido || sinObjetivo) return;
    Navigator.of(context).pop(MaintenanceInput(
      description: _description.text.trim(),
      nextDate: _date,
      nextMileage: _mileage.text.trim().isEmpty ? null : int.parse(_mileage.text.trim()),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return AlertDialog(
      title: Text(_isEdit ? 'Editar mantenimiento' : 'Registrar próximo mantenimiento'),
      content: SizedBox(
        width: 440,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _description,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Descripción *',
                  helperText: 'Por ejemplo: cambio de aceite y filtro.',
                ),
                validator: Validators.description,
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _pickDate,
                      icon: const Icon(LucideIcons.calendarDays, size: 18),
                      label: Text(_date == null ? 'Elegir fecha' : Format.dateOnly(_date)),
                    ),
                  ),
                  if (_date != null)
                    IconButton(
                      tooltip: 'Quitar fecha',
                      icon: const Icon(LucideIcons.x, size: 18),
                      onPressed: () => setState(() => _date = null),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _mileage,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Kilometraje objetivo',
                  helperText: widget.currentMileage == null
                      ? null
                      : 'Kilometraje actual: ${Format.mileage(widget.currentMileage!)}.',
                ),
                validator: _validateMileage,
                onChanged: (_) {
                  if (_targetError != null) setState(() => _targetError = null);
                },
              ),
              if (_targetError != null) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text(_targetError!, style: text.bodySmall?.copyWith(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.sm),
              Text(
                'La fecha, el kilometraje o ambos. Los avisos se muestran al llegar a cualquiera de los dos.',
                style: text.bodySmall,
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
