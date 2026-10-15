import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/client.dart';
import '../../models/paged_result.dart';
import '../../providers/auth_provider.dart';
import '../../providers/clients_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Listado de clientes con búsqueda y paginación.
class ClientsListScreen extends StatefulWidget {
  const ClientsListScreen({super.key});

  @override
  State<ClientsListScreen> createState() => _ClientsListScreenState();
}

class _ClientsListScreenState extends State<ClientsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientsProvider>().load(page: 1, search: '');
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String texto) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) context.read<ClientsProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _openForm() async {
    final Object? creado = await Navigator.of(context).pushNamed(AppRoutes.clientForm);
    if (creado == true && mounted) {
      context.read<ClientsProvider>().load(page: 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ClientsProvider clients = context.watch<ClientsProvider>();
    final bool canWrite = context.watch<AuthProvider>().role?.canManageRecords ?? false;
    final PagedResult<Client>? result = clients.result;

    return AppShell(
      currentRoute: AppRoutes.clients,
      title: 'Clientes',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 360),
                      child: TextField(
                        controller: _searchController,
                        onChanged: _onSearchChanged,
                        decoration: const InputDecoration(
                          hintText: 'Buscar por nombre, teléfono o correo',
                          prefixIcon: Icon(LucideIcons.search, size: 18),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                if (canWrite)
                  FilledButton.icon(
                    onPressed: _openForm,
                    icon: const Icon(LucideIcons.plus, size: 18),
                    label: const Text('Nuevo cliente'),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(
              child: Panel(child: _buildBody(clients, result, canWrite)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(ClientsProvider clients, PagedResult<Client>? result, bool canWrite) {
    if (result == null) {
      if (clients.error != null) {
        return ErrorStateView(message: clients.error!, onRetry: () => clients.load());
      }
      return const LoadingView();
    }
    if (clients.error != null) {
      return ErrorStateView(message: clients.error!, onRetry: () => clients.load());
    }
    if (result.items.isEmpty) {
      final bool buscando = clients.search.isNotEmpty;
      return EmptyStateView(
        message: buscando
            ? 'No se encontraron clientes con esa búsqueda.'
            : 'Aún no hay clientes registrados.',
        actionLabel: (!buscando && canWrite) ? 'Registrar el primer cliente' : null,
        onAction: (!buscando && canWrite) ? _openForm : null,
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Nombre')),
                  DataColumn(label: Text('Teléfono')),
                  DataColumn(label: Text('Correo electrónico')),
                  DataColumn(label: Text('Registro')),
                  DataColumn(label: Text('Acciones')),
                ],
                rows: <DataRow>[
                  for (final Client c in result.items)
                    DataRow(
                      onSelectChanged: (_) => Navigator.of(context).pushNamed(
                        AppRoutes.clientDetail,
                        arguments: c.id,
                      ),
                      cells: <DataCell>[
                        DataCell(Text(c.name, overflow: TextOverflow.ellipsis)),
                        DataCell(Text(c.phone)),
                        DataCell(Text(Format.orDash(c.email), overflow: TextOverflow.ellipsis)),
                        DataCell(Text(Format.date(c.createdAt))),
                        DataCell(
                          IconButton(
                            tooltip: 'Ver detalle',
                            icon: const Icon(LucideIcons.eye, size: 18),
                            onPressed: () => Navigator.of(context).pushNamed(
                              AppRoutes.clientDetail,
                              arguments: c.id,
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              if (clients.loading)
                const Positioned(
                  top: AppSpacing.sm,
                  right: AppSpacing.sm,
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
            ],
          ),
        ),
        PaginationBar(result: result, onPage: (int p) => clients.load(page: p)),
      ],
    );
  }
}
