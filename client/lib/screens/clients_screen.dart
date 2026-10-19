import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../providers/auth_provider.dart';
import '../providers/clients_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'client_detail_screen.dart';
import 'client_form_screen.dart';

/// Listado de clientes con búsqueda, filtro de estado y acciones según el rol.
class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  Timer? _debounce;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientsProvider>().load(page: 1);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String valor) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) context.read<ClientsProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm({Client? client}) async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ClientFormScreen(client: client)),
    );
    if (guardado == true && mounted) context.read<ClientsProvider>().load();
  }

  Future<void> _openDetail(Client client) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => ClientDetailScreen(clientId: client.id)),
    );
    if (mounted) context.read<ClientsProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ClientsProvider>();
    final puedeEscribir = context.select<AuthProvider, bool>((a) => a.canManageRecords);

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('campo-busqueda'),
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  decoration: const InputDecoration(
                    hintText: 'Buscar por nombre, teléfono o correo',
                    prefixIcon: Icon(LucideIcons.search, size: 18),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              SizedBox(
                width: 190,
                child: DropdownButtonFormField<bool?>(
                  key: const Key('filtro-estado'),
                  isExpanded: true,
                  initialValue: provider.activeFilter,
                  decoration: const InputDecoration(labelText: 'Estado'),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Todos')),
                    DropdownMenuItem(value: true, child: Text('Activos')),
                    DropdownMenuItem(value: false, child: Text('Inactivos')),
                  ],
                  onChanged: (valor) => context.read<ClientsProvider>().setActiveFilter(valor),
                ),
              ),
              if (puedeEscribir) ...[
                const SizedBox(width: AppSpacing.md),
                FilledButton(
                  onPressed: () => _openForm(),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.plus, size: 18),
                      SizedBox(width: AppSpacing.sm),
                      Text('Registrar cliente'),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: _buildBody(provider, puedeEscribir),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(ClientsProvider provider, bool puedeEscribir) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando clientes...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty || provider.activeFilter != null;
      return EmptyState(
        icon: LucideIcons.users,
        title: filtrando ? 'No se encontraron clientes' : 'Aún no hay clientes',
        message: filtrando
            ? 'Prueba con otro nombre, teléfono o correo.'
            : 'Los clientes que registres aparecerán aquí.',
        actionLabel: (!filtrando && puedeEscribir) ? 'Registrar cliente' : null,
        onAction: (!filtrando && puedeEscribir) ? () => _openForm() : null,
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 760,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Nombre'), size: ColumnSize.L),
              DataColumn2(label: Text('Teléfono'), size: ColumnSize.M),
              DataColumn2(label: Text('Correo'), size: ColumnSize.L),
              DataColumn2(label: Text('Estado'), size: ColumnSize.S),
              DataColumn2(label: Text('Acciones'), fixedWidth: 110),
            ],
            rows: [
              for (final cliente in provider.items)
                DataRow2(
                  onTap: () => _openDetail(cliente),
                  cells: [
                    DataCell(Text(cliente.name, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(formatPhone(cliente.phone))),
                    DataCell(Text(cliente.email ?? '—', overflow: TextOverflow.ellipsis)),
                    DataCell(StatusChip.active(cliente.active)),
                    DataCell(Row(
                      children: [
                        IconButton(
                          tooltip: 'Ver detalle',
                          onPressed: () => _openDetail(cliente),
                          icon: const Icon(LucideIcons.eye, size: 18),
                        ),
                        if (puedeEscribir)
                          IconButton(
                            tooltip: 'Editar',
                            onPressed: () => _openForm(client: cliente),
                            icon: const Icon(LucideIcons.pencil, size: 18),
                          ),
                      ],
                    )),
                  ],
                ),
            ],
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
          child: Row(
            children: [
              Text('${provider.total} cliente${provider.total == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.bodySmall),
              const Spacer(),
              IconButton(
                tooltip: 'Página anterior',
                onPressed: provider.page > 1 ? () => provider.load(page: provider.page - 1) : null,
                icon: const Icon(LucideIcons.chevronLeft, size: 18),
              ),
              Text('${provider.page} de ${provider.totalPages}'),
              IconButton(
                tooltip: 'Página siguiente',
                onPressed:
                    provider.page < provider.totalPages ? () => provider.load(page: provider.page + 1) : null,
                icon: const Icon(LucideIcons.chevronRight, size: 18),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
