import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/api_error.dart';
import '../models/part.dart';
import '../providers/inventory_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../utils/validators.dart';

/// Refacción elegida y cantidad a usar en la orden.
class PartSelection {
  const PartSelection({required this.partId, required this.quantity});

  final int partId;
  final int quantity;
}

/// Diálogo para buscar una refacción disponible y elegir la cantidad. Devuelve la selección o
/// null si se cancela. La cantidad no puede superar la existencia visible.
Future<PartSelection?> showPartPickerDialog(BuildContext context) {
  return showDialog<PartSelection>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => const _PartPickerDialog(),
  );
}

class _PartPickerDialog extends StatefulWidget {
  const _PartPickerDialog();

  @override
  State<_PartPickerDialog> createState() => _PartPickerDialogState();
}

class _PartPickerDialogState extends State<_PartPickerDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _search = TextEditingController();
  final TextEditingController _quantity = TextEditingController(text: '1');
  Timer? _debounce;

  List<AvailablePart> _results = <AvailablePart>[];
  AvailablePart? _selected;
  bool _searching = false;
  bool _searched = false;
  String? _error;
  int _requestId = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _quantity.dispose();
    super.dispose();
  }

  void _onSearchChanged(String texto) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _runSearch(texto.trim()));
  }

  Future<void> _runSearch(String texto) async {
    if (texto.length < 2) {
      setState(() {
        _results = <AvailablePart>[];
        _searched = false;
        _error = null;
        _selected = null;
      });
      return;
    }
    final int solicitud = ++_requestId;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final List<AvailablePart> encontradas =
          await context.read<InventoryProvider>().searchAvailable(texto);
      if (!mounted || solicitud != _requestId) return;
      setState(() {
        _results = encontradas;
        _searched = true;
        _searching = false;
        if (_selected != null && !encontradas.any((AvailablePart p) => p.id == _selected!.id)) {
          _selected = null;
        }
      });
    } on ApiError catch (error) {
      if (!mounted || solicitud != _requestId) return;
      setState(() {
        _error = error.message;
        _searching = false;
      });
    }
  }

  String? _validateQuantity(String? valor) {
    final String? base = Validators.quantity(valor);
    if (base != null) return base;
    final AvailablePart? elegida = _selected;
    if (elegida != null && int.parse(valor!.trim()) > elegida.stock) {
      return 'Solo hay ${elegida.stock} en existencia.';
    }
    return null;
  }

  void _submit() {
    if (_selected == null) {
      setState(() => _error = 'Elige una refacción de la lista.');
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(
      PartSelection(partId: _selected!.id, quantity: int.parse(_quantity.text.trim())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return AlertDialog(
      title: const Text('Agregar refacción'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextField(
                controller: _search,
                autofocus: true,
                onChanged: _onSearchChanged,
                decoration: const InputDecoration(
                  hintText: 'Buscar por código o nombre (mínimo 2 caracteres)',
                  prefixIcon: Icon(LucideIcons.search, size: 18),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 120, maxHeight: 240),
                child: _buildResults(text),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: AppSpacing.sm),
                Text(_error!, style: text.bodySmall?.copyWith(color: AppColors.danger)),
              ],
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: _quantity,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Cantidad *'),
                validator: _validateQuantity,
                onFieldSubmitted: (_) => _submit(),
              ),
            ],
          ),
        ),
      ),
      actions: <Widget>[
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _submit, child: const Text('Agregar')),
      ],
    );
  }

  Widget _buildResults(TextTheme text) {
    if (_searching) {
      return const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)));
    }
    if (!_searched) {
      return Center(
        child: Text('Escribe para buscar refacciones disponibles.', style: text.bodySmall),
      );
    }
    if (_results.isEmpty) {
      return Center(
        child: Text('No hay refacciones disponibles con ese texto.', style: text.bodySmall),
      );
    }
    return ListView(
      shrinkWrap: true,
      children: <Widget>[
        for (final AvailablePart p in _results)
          ListTile(
            dense: true,
            selected: _selected?.id == p.id,
            selectedTileColor: AppColors.background,
            title: Text('${p.code} · ${p.name}'),
            subtitle: Text('Precio ${Format.money(p.price)} · Existencia ${p.stock}'),
            trailing: _selected?.id == p.id
                ? const Icon(LucideIcons.check, size: 18, color: AppColors.success)
                : null,
            onTap: () => setState(() {
              _selected = p;
              _error = null;
            }),
          ),
      ],
    );
  }
}
