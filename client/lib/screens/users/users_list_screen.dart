import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/paged_result.dart';
import '../../models/user.dart';
import '../../providers/users_provider.dart';
import '../../utils/app_theme.dart';
import '../../widgets/app_data_table.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/pagination_bar.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Listado de usuarios con búsqueda, filtros por rol y estado, y paginación (solo ADMIN).
class UsersListScreen extends StatefulWidget {
  const UsersListScreen({super.key});

  @override
  State<UsersListScreen> createState() => _UsersListScreenState();
}

class _UsersListScreenState extends State<UsersListScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<UsersProvider>().load(page: 1, search: '', clearRole: true, clearActive: true);
      }
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
      if (mounted) context.read<UsersProvider>().load(page: 1, search: texto);
    });
  }

  Future<void> _openForm([AppUser? user]) async {
    final Object? guardado = await Navigator.of(context).pushNamed(
      AppRoutes.userForm,
      arguments: user,
    );
    if (guardado == true && mounted) context.read<UsersProvider>().load(page: 1);
  }

  @override
  Widget build(BuildContext context) {
    final UsersProvider users = context.watch<UsersProvider>();
    final PagedResult<AppUser>? result = users.result;

    return AppShell(
      currentRoute: AppRoutes.users,
      title: 'Usuarios',
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Wrap(
                    spacing: AppSpacing.md,
                    runSpacing: AppSpacing.md,
                    children: <Widget>[
                      SizedBox(
                        width: 320,
                        child: TextField(
                          controller: _searchController,
                          onChanged: _onSearchChanged,
                          decoration: const InputDecoration(
                            hintText: 'Buscar por usuario, nombre o correo',
                            prefixIcon: Icon(LucideIcons.search, size: 18),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 190,
                        child: DropdownButtonFormField<UserRole?>(
                          key: ValueKey<UserRole?>(users.roleFilter),
                          initialValue: users.roleFilter,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Rol'),
                          items: <DropdownMenuItem<UserRole?>>[
                            const DropdownMenuItem<UserRole?>(value: null, child: Text('Todos')),
                            for (final UserRole r in UserRole.values)
                              DropdownMenuItem<UserRole?>(value: r, child: Text(r.label)),
                          ],
                          onChanged: (UserRole? r) =>
                              users.load(page: 1, role: r, clearRole: r == null),
                        ),
                      ),
                      SizedBox(
                        width: 170,
                        child: DropdownButtonFormField<bool?>(
                          key: ValueKey<bool?>(users.activeFilter),
                          initialValue: users.activeFilter,
                          isExpanded: true,
                          decoration: const InputDecoration(labelText: 'Estado'),
                          items: const <DropdownMenuItem<bool?>>[
                            DropdownMenuItem<bool?>(value: null, child: Text('Todos')),
                            DropdownMenuItem<bool?>(value: true, child: Text('Activos')),
                            DropdownMenuItem<bool?>(value: false, child: Text('Inactivos')),
                          ],
                          onChanged: (bool? a) =>
                              users.load(page: 1, active: a, clearActive: a == null),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.lg),
                FilledButton.icon(
                  onPressed: () => _openForm(),
                  icon: const Icon(LucideIcons.plus, size: 18),
                  label: const Text('Nuevo usuario'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Expanded(child: Panel(child: _buildBody(users, result))),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(UsersProvider users, PagedResult<AppUser>? result) {
    if (users.error != null) {
      return ErrorStateView(message: users.error!, onRetry: () => users.load());
    }
    if (result == null) return const LoadingView();
    if (result.items.isEmpty) {
      return EmptyStateView(
        message: users.hasFilters
            ? 'No se encontraron usuarios con esos filtros.'
            : 'Aún no hay usuarios registrados.',
      );
    }

    return Column(
      children: <Widget>[
        Expanded(
          child: Stack(
            children: <Widget>[
              AppDataTable(
                columns: const <DataColumn>[
                  DataColumn(label: Text('Usuario')),
                  DataColumn(label: Text('Nombre')),
                  DataColumn(label: Text('Correo electrónico')),
                  DataColumn(label: Text('Rol')),
                  DataColumn(label: Text('Estado')),
                  DataColumn(label: Text('Acciones')),
                ],
                rows: <DataRow>[
                  for (final AppUser u in result.items)
                    DataRow(
                      onSelectChanged: (_) => _openForm(u),
                      cells: <DataCell>[
                        DataCell(Text(u.username)),
                        DataCell(Text(u.name, overflow: TextOverflow.ellipsis)),
                        DataCell(Text(u.email, overflow: TextOverflow.ellipsis)),
                        DataCell(Chip(label: Text(u.role.label))),
                        DataCell(_StatusChip(active: u.active)),
                        DataCell(
                          IconButton(
                            tooltip: 'Editar usuario',
                            icon: const Icon(LucideIcons.pencil, size: 18),
                            onPressed: () => _openForm(u),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              if (users.loading)
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
        PaginationBar(result: result, onPage: (int p) => users.load(page: p)),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final Color color = active ? AppColors.success : AppColors.textSecondary;
    return Chip(
      label: Text(active ? 'Activo' : 'Inactivo'),
      labelStyle: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
      side: BorderSide(color: color),
    );
  }
}
