import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'state_views.dart';
import 'status_chip.dart';

/// Resultado del selector: refacción elegida y cantidad.
class PartSelection {
  const PartSelection({required this.part, required this.quantity});

  final Part part;
  final int quantity;
}

/// Diálogo para buscar una refacción activa y elegir la cantidad a usar en una orden.
/// Advierte si el stock es bajo o cero y limita la cantidad al stock disponible.
Future<PartSelection?> showPartPicker(BuildContext context) {
  final provider = context.read<PartsProvider>();
  return showDialog<PartSelection>(context: context, builder: (_) => PartPickerDialog(provider: provider));
}

class PartPickerDialog extends StatefulWidget {
  const PartPickerDialog({super.key, required this.provider});

  final PartsProvider provider;

  @override
  State<PartPickerDialog> createState() => _PartPickerDialogState();
}

class _PartPickerDialogState extends State<PartPickerDialog> {
  final _quantity = TextEditingController(text: '1');
  Timer? _debounce;
  List<Part> _results = [];
  Part? _selected;
  bool _loading = true;
  String? _error;
  String? _quantityError;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _quantity.dispose();
    super.dispose();
  }

  Future<void> _search(String texto) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final partes = await widget.provider.searchForOrder(texto);
      if (mounted) setState(() => _results = partes);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onChanged(String valor) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(valor));
  }

  void _confirm() {
    final parte = _selected;
    if (parte == null) return;
    final cantidad = int.tryParse(_quantity.text.trim());
    String? problema;
    if (cantidad == null || cantidad < 1) {
      problema = 'La cantidad debe ser un número entero mayor a 0.';
    } else if (cantidad > parte.stock) {
      problema = 'Solo hay ${parte.stock} pieza${parte.stock == 1 ? '' : 's'} disponible${parte.stock == 1 ? '' : 's'}.';
    }
    if (problema != null) {
      setState(() => _quantityError = problema);
      return;
    }
    Navigator.of(context).pop(PartSelection(part: parte, quantity: cantidad!));
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final parte = _selected;
    return AlertDialog(
      title: const Text('Agregar refacción'),
      content: SizedBox(
        width: 520,
        height: 440,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('buscar-refaccion'),
              autofocus: true,
              onChanged: _onChanged,
              decoration: const InputDecoration(
                hintText: 'Buscar por código, nombre o categoría',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: _loading
                  ? const LoadingState()
                  : _error != null
                      ? ErrorState(message: _error!, onRetry: () => _search(''))
                      : _results.isEmpty
                          ? const EmptyState(icon: LucideIcons.package, title: 'No se encontraron refacciones')
                          : ListView.separated(
                              itemCount: _results.length,
                              separatorBuilder: (_, _) => const Divider(height: 1),
                              itemBuilder: (_, i) {
                                final p = _results[i];
                                return ListTile(
                                  key: Key('refaccion-${p.id}'),
                                  selected: p.id == parte?.id,
                                  enabled: p.stock > 0,
                                  title: Text(p.name, overflow: TextOverflow.ellipsis),
                                  subtitle: Text(
                                    '${p.code} · ${formatMoney(p.salePrice)} · Stock: ${p.stock}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  trailing: p.stockLevel == 'OK' ? null : StatusChip.stock(p.stockLevel),
                                  onTap: () => setState(() {
                                    _selected = p;
                                    _quantityError = null;
                                  }),
                                );
                              },
                            ),
            ),
            if (parte != null) ...[
              const SizedBox(height: AppSpacing.md),
              if (parte.stockLevel == 'LOW')
                Text(
                  key: const Key('advertencia-stock'),
                  'Stock bajo: quedan ${parte.stock} pieza${parte.stock == 1 ? '' : 's'}.',
                  style: texto.bodySmall?.copyWith(color: AppColors.warning),
                ),
              const SizedBox(height: AppSpacing.sm),
              TextField(
                key: const Key('campo-cantidad'),
                controller: _quantity,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Cantidad (máximo ${parte.stock})',
                  errorText: _quantityError,
                ),
                onChanged: (_) => setState(() => _quantityError = null),
              ),
            ],
          ],
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: parte == null ? null : _confirm, child: const Text('Agregar')),
      ],
    );
  }
}

/// Diálogo sencillo para cambiar la cantidad de una refacción de la orden. Devuelve la nueva cantidad o `null`.
Future<int?> showQuantityDialog(
  BuildContext context, {
  required String title,
  required String label,
  required int initial,
}) {
  return showDialog<int>(
    context: context,
    builder: (_) => _QuantityDialog(title: title, label: label, initial: initial),
  );
}

class _QuantityDialog extends StatefulWidget {
  const _QuantityDialog({required this.title, required this.label, required this.initial});

  final String title;
  final String label;
  final int initial;

  @override
  State<_QuantityDialog> createState() => _QuantityDialogState();
}

class _QuantityDialogState extends State<_QuantityDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller = TextEditingController(text: widget.initial.toString());

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _guardar() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(int.parse(_controller.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 360,
        child: Form(
          key: _formKey,
          child: TextFormField(
            key: const Key('campo-cantidad'),
            controller: _controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: widget.label),
            validator: (v) {
              final cantidad = int.tryParse((v ?? '').trim());
              if (cantidad == null || cantidad < 1 || cantidad > 1000000) {
                return 'La cantidad debe ser un número entero entre 1 y 1,000,000.';
              }
              return null;
            },
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
