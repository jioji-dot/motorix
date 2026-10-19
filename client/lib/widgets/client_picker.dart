import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../providers/clients_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import 'state_views.dart';

/// Abre el diálogo para buscar y elegir un cliente activo. Devuelve `null` si se cancela.
Future<Client?> showClientPicker(BuildContext context) {
  final provider = context.read<ClientsProvider>();
  return showDialog<Client>(context: context, builder: (_) => ClientPickerDialog(provider: provider));
}

/// Diálogo para buscar y elegir un cliente entre los activos.
class ClientPickerDialog extends StatefulWidget {
  const ClientPickerDialog({super.key, required this.provider});

  final ClientsProvider provider;

  @override
  State<ClientPickerDialog> createState() => _ClientPickerDialogState();
}

class _ClientPickerDialogState extends State<ClientPickerDialog> {
  Timer? _debounce;
  List<Client> _results = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _search(String texto) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final resultados = await widget.provider.searchClients(texto);
      if (mounted) setState(() => _results = resultados);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Elegir cliente'),
      content: SizedBox(
        width: 460,
        height: 360,
        child: Column(
          children: [
            TextField(
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Buscar cliente por nombre',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
              onChanged: (valor) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 300), () => _search(valor));
              },
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
              child: _loading
                  ? const LoadingState()
                  : _error != null
                      ? ErrorState(message: _error!, onRetry: () => _search(''))
                      : _results.isEmpty
                          ? const EmptyState(title: 'No se encontraron clientes', icon: LucideIcons.users)
                          : ListView.separated(
                              itemCount: _results.length,
                              separatorBuilder: (_, _) => const Divider(),
                              itemBuilder: (_, i) => ListTile(
                                title: Text(_results[i].name),
                                subtitle: Text(formatPhone(_results[i].phone)),
                                onTap: () => Navigator.of(context).pop(_results[i]),
                              ),
                            ),
            ),
          ],
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
      ],
    );
  }
}
