import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../models/paged_result.dart';
import '../services/clients_service.dart';
import '../utils/app_theme.dart';

/// Selector de propietario con búsqueda de clientes. Es obligatorio al registrar un vehículo.
class OwnerPicker extends StatefulWidget {
  const OwnerPicker({
    super.key,
    required this.selected,
    required this.onChanged,
    this.errorText,
    this.enabled = true,
    this.label = 'Propietario *',
  });

  final Client? selected;
  final ValueChanged<Client?> onChanged;
  final String? errorText;
  final bool enabled;
  final String label;

  @override
  State<OwnerPicker> createState() => _OwnerPickerState();
}

class _OwnerPickerState extends State<OwnerPicker> {
  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;
  List<Client> _results = <Client>[];
  bool _searching = false;
  String? _searchError;
  int _requestId = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String texto) {
    _debounce?.cancel();
    if (texto.trim().isEmpty) {
      setState(() {
        _results = <Client>[];
        _searchError = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(texto.trim()));
  }

  Future<void> _search(String texto) async {
    final int solicitud = ++_requestId;
    setState(() {
      _searching = true;
      _searchError = null;
    });
    try {
      final PagedResult<Client> pagina = await context.read<ClientsService>().list(
            search: texto,
            pageSize: 5,
          );
      if (!mounted || solicitud != _requestId) return;
      setState(() => _results = pagina.items);
    } catch (_) {
      if (!mounted || solicitud != _requestId) return;
      setState(() => _searchError = 'No se pudo buscar clientes. Inténtalo de nuevo.');
    } finally {
      if (mounted && solicitud == _requestId) setState(() => _searching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final Client? seleccionado = widget.selected;

    if (seleccionado != null) {
      return InputDecorator(
        decoration: InputDecoration(labelText: widget.label, errorText: widget.errorText),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                seleccionado.phone.isEmpty
                    ? seleccionado.name
                    : '${seleccionado.name} · ${seleccionado.phone}',
                style: text.bodyMedium,
              ),
            ),
            if (widget.enabled)
              TextButton(
                onPressed: () {
                  _controller.clear();
                  setState(() => _results = <Client>[]);
                  widget.onChanged(null);
                },
                child: const Text('Cambiar'),
              ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        TextField(
          controller: _controller,
          enabled: widget.enabled,
          onChanged: _onChanged,
          decoration: InputDecoration(
            labelText: widget.label,
            hintText: 'Busca al cliente por nombre, teléfono o correo',
            prefixIcon: const Icon(LucideIcons.search, size: 18),
            errorText: widget.errorText,
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(AppSpacing.md),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : null,
          ),
        ),
        if (_searchError != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(_searchError!, style: text.bodySmall?.copyWith(color: AppColors.danger)),
          ),
        if (_results.isEmpty && _controller.text.trim().isNotEmpty && !_searching && _searchError == null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text('No se encontraron clientes.', style: text.bodySmall),
          ),
        if (_results.isNotEmpty)
          // Material propio: el panel pinta un fondo y el efecto de ListTile quedaría oculto.
          Material(
            color: AppColors.surface,
            child: Column(
              children: <Widget>[
                for (final Client c in _results)
                  ListTile(
                    dense: true,
                    title: Text(c.name),
                    subtitle: Text(c.phone),
                    onTap: () => widget.onChanged(c),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
