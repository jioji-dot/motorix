import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/part.dart';
import '../../providers/inventory_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/validators.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Formulario de refacción: alta (sin [part]) o edición (con [part]). Solo ADMIN.
/// La existencia inicial solo se captura al registrar; después cambia con entradas y ajustes.
class PartFormScreen extends StatefulWidget {
  const PartFormScreen({super.key, this.part});

  final Part? part;

  @override
  State<PartFormScreen> createState() => _PartFormScreenState();
}

class _PartFormScreenState extends State<PartFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _code;
  late final TextEditingController _name;
  late final TextEditingController _description;
  late final TextEditingController _price;
  late final TextEditingController _minimum;
  final TextEditingController _initial = TextEditingController();

  bool _saving = false;
  bool _allowPop = false;
  Map<String, String> _serverErrors = <String, String>{};

  Part? get _part => widget.part;
  bool get _isEdit => _part != null;

  @override
  void initState() {
    super.initState();
    final Part? p = _part;
    _code = TextEditingController(text: p?.code ?? '');
    _name = TextEditingController(text: p?.name ?? '');
    _description = TextEditingController(text: p?.description ?? '');
    _price = TextEditingController(text: p == null ? '' : p.price.toStringAsFixed(2));
    _minimum = TextEditingController(text: p == null ? '0' : '${p.minimumStock}');
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _minimum.dispose();
    _initial.dispose();
    super.dispose();
  }

  bool get _dirty {
    final Part? p = _part;
    if (p == null) {
      return _code.text.isNotEmpty ||
          _name.text.isNotEmpty ||
          _description.text.isNotEmpty ||
          _price.text.isNotEmpty ||
          _initial.text.isNotEmpty ||
          _minimum.text != '0';
    }
    return _code.text != p.code ||
        _name.text != p.name ||
        _description.text != (p.description ?? '') ||
        _price.text != p.price.toStringAsFixed(2) ||
        _minimum.text != '${p.minimumStock}';
  }

  PartInput _buildInput() {
    final String descripcion = _description.text.trim();
    return PartInput(
      code: _code.text.trim(),
      name: _name.text.trim(),
      description: descripcion.isEmpty ? null : descripcion,
      price: Validators.parseDecimal(_price.text)!,
      minimumStock: int.parse(_minimum.text.trim()),
      initialStock: _isEdit || _initial.text.trim().isEmpty ? null : int.parse(_initial.text.trim()),
    );
  }

  Future<void> _save() async {
    setState(() => _serverErrors = <String, String>{});
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    final InventoryProvider provider = context.read<InventoryProvider>();
    try {
      if (_isEdit) {
        await provider.update(_part!.id, _buildInput());
      } else {
        await provider.create(_buildInput());
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        _isEdit ? 'Refacción actualizada correctamente.' : 'Refacción registrada correctamente.',
      );
      setState(() => _allowPop = true);
      Navigator.of(context).pop(true);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      _handleError(error);
    }
  }

  void _handleError(ApiError error) {
    switch (error.code) {
      case 'PART_CODE_DUPLICATE':
        setState(() => _serverErrors = <String, String>{'code': error.message});
      case 'VALIDATION_ERROR' when error.details is List:
        final Map<String, String> campos = <String, String>{};
        for (final dynamic d in error.details as List<dynamic>) {
          if (d is Map && d['field'] != null) {
            campos[d['field'] as String] = d['message'] as String;
          }
        }
        setState(() => _serverErrors = campos);
      default:
        showAppSnackBar(context, error.message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _allowPop || !_dirty,
      onPopInvokedWithResult: (bool didPop, Object? result) async {
        if (didPop) return;
        final bool salir = await showConfirmDialog(
          context,
          title: 'Salir sin guardar',
          message: '¿Seguro que quieres salir? Los cambios sin guardar se perderán.',
        );
        if (salir && context.mounted) {
          setState(() => _allowPop = true);
          Navigator.of(context).pop();
        }
      },
      child: AppShell(
        currentRoute: AppRoutes.inventory,
        title: _isEdit ? 'Editar refacción' : 'Nueva refacción',
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Align(
            alignment: Alignment.topLeft,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Panel(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Form(
                  key: _formKey,
                  onChanged: () => setState(() {}),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      TextFormField(
                        controller: _code,
                        enabled: !_saving,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: 'Código *',
                          errorText: _serverErrors['code'],
                        ),
                        validator: Validators.partCode,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _name,
                        enabled: !_saving,
                        decoration: InputDecoration(
                          labelText: 'Nombre *',
                          errorText: _serverErrors['name'],
                        ),
                        validator: (String? v) =>
                            Validators.required(v, 'el nombre') ?? Validators.maxLength(v, 150),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _description,
                        enabled: !_saving,
                        maxLines: 3,
                        decoration: InputDecoration(
                          labelText: 'Descripción',
                          errorText: _serverErrors['description'],
                        ),
                        validator: (String? v) => Validators.maxLength(v, 500),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(
                            child: TextFormField(
                              controller: _price,
                              enabled: !_saving,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Precio *',
                                errorText: _serverErrors['price'],
                              ),
                              validator: (String? v) => Validators.amount(v, 'el precio'),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: TextFormField(
                              controller: _minimum,
                              enabled: !_saving,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: 'Stock mínimo *',
                                errorText: _serverErrors['minimumStock'],
                              ),
                              validator: (String? v) => Validators.stock(v, 'el stock mínimo'),
                            ),
                          ),
                        ],
                      ),
                      if (!_isEdit) ...<Widget>[
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _initial,
                          enabled: !_saving,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Existencia inicial',
                            helperText: 'Opcional. Se registra como una entrada de inventario.',
                            errorText: _serverErrors['initialStock'],
                          ),
                          validator: (String? v) => (v ?? '').trim().isEmpty
                              ? null
                              : Validators.stock(v, 'la existencia inicial'),
                        ),
                      ] else ...<Widget>[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          'La existencia (${_part!.stock}) solo cambia con entradas y ajustes.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: <Widget>[
                          OutlinedButton(
                            onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                            child: const Text('Cancelar'),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          FilledButton(
                            onPressed: _saving ? null : _save,
                            child: _saving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.onPrimary,
                                    ),
                                  )
                                : const Text('Guardar'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
