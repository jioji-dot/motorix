import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/users_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/list_toolbar.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'user_form_screen.dart';

/// Gestión de usuarios y roles (solo ADMIN; el backend también valida el rol).
class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<UsersProvider>().load(page: 1);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String valor) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) context.read<UsersProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm({User? user}) async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => UserFormScreen(user: user)),
    );
    if (guardado == true && mounted) context.read<UsersProvider>().load();
  }

  Future<void> _toggleActive(User user) async {
    final provider = context.read<UsersProvider>();
    if (user.active) {
      final confirmado = await showConfirmDialog(
        context,
        title: 'Desactivar usuario',
        message: '${user.name} dejará de poder iniciar sesión de inmediato. Podrás reactivarlo cuando quieras.',
        destructive: true,
      );
      if (!confirmado || !mounted) return;
    }
    try {
      await provider.update(user.id, {'active': !user.active});
      if (!mounted) return;
      showFeedback(context, user.active ? 'Usuario desactivado.' : 'Usuario reactivado.');
      await provider.load();
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<UsersProvider>();

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListToolbar(
            search: TextField(
              key: const Key('campo-busqueda'),
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'Buscar por nombre, usuario o correo',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
            ),
            actions: [
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
                  onChanged: (valor) => context.read<UsersProvider>().setActiveFilter(valor),
                ),
              ),
              FilledButton(
                onPressed: () => _openForm(),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(LucideIcons.plus, size: 18),
                    SizedBox(width: AppSpacing.sm),
                    Flexible(child: Text('Registrar usuario', overflow: TextOverflow.ellipsis)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Expanded(
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: _buildBody(provider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(UsersProvider provider) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando usuarios...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty || provider.activeFilter != null;
      return EmptyState(
        icon: LucideIcons.userCog,
        title: filtrando ? 'No se encontraron usuarios' : 'Aún no hay usuarios',
        message: filtrando ? 'Prueba con otro nombre, usuario o correo.' : null,
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 820,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Nombre'), size: ColumnSize.L),
              DataColumn2(label: Text('Usuario'), size: ColumnSize.M),
              DataColumn2(label: Text('Correo'), size: ColumnSize.L),
              DataColumn2(label: Text('Rol'), size: ColumnSize.M),
              DataColumn2(label: Text('Estado'), size: ColumnSize.S),
              DataColumn2(label: Text('Acciones'), fixedWidth: 110),
            ],
            rows: [
              for (final usuario in provider.items)
                DataRow2(
                  cells: [
                    DataCell(Text(usuario.name, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(usuario.username, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(usuario.email, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(usuario.role.label)),
                    DataCell(StatusChip.active(usuario.active)),
                    DataCell(Row(
                      children: [
                        IconButton(
                          tooltip: 'Editar',
                          onPressed: () => _openForm(user: usuario),
                          icon: const Icon(LucideIcons.pencil, size: 18),
                        ),
                        IconButton(
                          tooltip: usuario.active ? 'Desactivar' : 'Reactivar',
                          onPressed: () => _toggleActive(usuario),
                          icon: Icon(usuario.active ? LucideIcons.userX : LucideIcons.userCheck, size: 18),
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
              Expanded(
                child: Text(
                  '${provider.total} usuario${provider.total == 1 ? '' : 's'}',
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
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
