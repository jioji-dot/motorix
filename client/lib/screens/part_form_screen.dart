import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/button_spinner.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

const double _importeMaximo = 99999999.99;
const int _stockMaximo = 1000000;

String? _validarTexto(String? valor, String etiqueta, int maximo) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return '$etiqueta es ${etiqueta.startsWith('La ') ? 'obligatoria' : 'obligatorio'}.';
  if (texto.length > maximo) return '$etiqueta no puede tener más de $maximo caracteres.';
  return null;
}

String? _validarEntero(String? valor, String etiqueta) {
  final texto = (valor ?? '').trim();
  final numero = int.tryParse(texto);
  if (numero == null || numero < 0 || numero > _stockMaximo) {
    return '$etiqueta debe ser un número entero entre 0 y 1,000,000.';
  }
  return null;
}

String? _validarPrecio(String? valor, String etiqueta) {
  final texto = (valor ?? '').trim();
  if (texto.isEmpty) return '$etiqueta es obligatorio.';
  final numero = double.tryParse(texto);
  if (numero == null) return '$etiqueta no es válido.';
  if (numero < 0) return '$etiqueta no puede ser menor a 0.';
  if (numero > _importeMaximo) return '$etiqueta no puede ser mayor a 99,999,999.99.';
  if ((numero * 100 - (numero * 100).roundToDouble()).abs() > 1e-6) return '$etiqueta puede tener hasta dos decimales.';
  return null;
}

/// Alta y edición de una refacción (solo administrador). El código y el stock no se editan.
/// Devuelve `true` al guardar.
class PartFormScreen extends StatefulWidget {
  const PartFormScreen({super.key, this.part});

  /// Si se indica, el formulario edita esa refacción.
  final Part? part;

  @override
  State<PartFormScreen> createState() => _PartFormScreenState();
}

class _PartFormScreenState extends State<PartFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _code;
  late final TextEditingController _name;
  late final TextEditingController _category;
  late final TextEditingController _brand;
  late final TextEditingController _minimumStock;
  late final TextEditingController _initialStock;
  late final TextEditingController _purchasePrice;
  late final TextEditingController _salePrice;
  bool _saving = false;
  String? _error;
  String? _codeError;

  bool get _editing => widget.part != null;

  @override
  void initState() {
    super.initState();
    final p = widget.part;
    _code = TextEditingController(text: p?.code ?? '');
    _name = TextEditingController(text: p?.name ?? '');
    _category = TextEditingController(text: p?.category ?? '');
    _brand = TextEditingController(text: p?.brand ?? '');
    _minimumStock = TextEditingController(text: p?.minimumStock.toString() ?? '');
    _initialStock = TextEditingController(text: '');
    _purchasePrice = TextEditingController(text: p?.purchasePrice ?? '');
    _salePrice = TextEditingController(text: p?.salePrice ?? '');
  }

  @override
  void dispose() {
    for (final c in [_code, _name, _category, _brand, _minimumStock, _initialStock, _purchasePrice, _salePrice]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _dirty {
    final p = widget.part;
    return _code.text != (p?.code ?? '') ||
        _name.text != (p?.name ?? '') ||
        _category.text != (p?.category ?? '') ||
        _brand.text != (p?.brand ?? '') ||
        _minimumStock.text != (p?.minimumStock.toString() ?? '') ||
        _initialStock.text.isNotEmpty ||
        _purchasePrice.text != (p?.purchasePrice ?? '') ||
        _salePrice.text != (p?.salePrice ?? '');
  }

  Map<String, dynamic> _datos() => {
        if (!_editing) 'code': _code.text.trim(),
        'name': _name.text.trim(),
        'category': _category.text.trim(),
        'brand': _brand.text.trim(),
        'minimumStock': int.parse(_minimumStock.text.trim()),
        'purchasePrice': double.parse(_purchasePrice.text.trim()),
        'salePrice': double.parse(_salePrice.text.trim()),
        if (!_editing && _initialStock.text.trim().isNotEmpty) 'initialStock': int.parse(_initialStock.text.trim()),
      };

  Future<void> _save() async {
    setState(() => _codeError = null);
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final provider = context.read<PartsProvider>();
    try {
      if (_editing) {
        await provider.update(widget.part!.id, _datos());
      } else {
        await provider.create(_datos());
      }
      if (!mounted) return;
      showFeedback(context, _editing ? 'Refacción actualizada correctamente.' : 'Refacción registrada correctamente.');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'DUPLICATE_VALUE') {
        setState(() => _codeError = 'Ya existe una refacción con ese código.');
        _formKey.currentState!.validate();
      } else {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final salir = await confirmDiscardChanges(context);
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Editar refacción' : 'Registrar refacción'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: Align(
          alignment: Alignment.topCenter,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Form(
                key: _formKey,
                onChanged: () => setState(() {}),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('campo-codigo'),
                      controller: _code,
                      enabled: !_editing,
                      decoration: InputDecoration(
                        labelText: 'Código',
                        helperText: _editing ? 'El código no se puede cambiar.' : null,
                      ),
                      validator: (v) => _codeError ?? _validarTexto(v, 'El código', 40),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-nombre'),
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Nombre'),
                      validator: (v) => _validarTexto(v, 'El nombre', 120),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-categoria'),
                            controller: _category,
                            decoration: const InputDecoration(labelText: 'Categoría'),
                            validator: (v) => _validarTexto(v, 'La categoría', 60),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-marca'),
                            controller: _brand,
                            decoration: const InputDecoration(labelText: 'Marca'),
                            validator: (v) => _validarTexto(v, 'La marca', 60),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-stock-minimo'),
                            controller: _minimumStock,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Stock mínimo'),
                            validator: (v) => _validarEntero(v, 'El stock mínimo'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-existencia-inicial'),
                            controller: _initialStock,
                            enabled: !_editing,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Existencia inicial',
                              helperText: _editing ? 'Usa un movimiento para cambiar el stock.' : 'Opcional.',
                              helperMaxLines: 2,
                            ),
                            validator: (v) => (v ?? '').trim().isEmpty ? null : _validarEntero(v, 'La existencia inicial'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-precio-compra'),
                            controller: _purchasePrice,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(labelText: 'Precio de compra'),
                            validator: (v) => _validarPrecio(v, 'El precio de compra'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          child: TextFormField(
                            key: const Key('campo-precio-venta'),
                            controller: _salePrice,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(labelText: 'Precio de venta'),
                            validator: (v) => _validarPrecio(v, 'El precio de venta'),
                          ),
                        ),
                      ],
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(_error!, style: texto.bodyMedium?.copyWith(color: AppColors.danger)),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton(
                          onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                          child: const Text('Cancelar'),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        FilledButton(
                          onPressed: _saving ? null : _save,
                          child: _saving ? const ButtonSpinner() : const Text('Guardar'),
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
    );
  }
}
