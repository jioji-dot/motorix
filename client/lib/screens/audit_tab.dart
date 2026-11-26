import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/audit_entry.dart';
import '../providers/audit_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/state_views.dart';

/// Bitácora de acciones sensibles: solo lectura, con filtros por fecha, usuario y acción y paginación (Sprint 7, solo administrador).
class AuditTab extends StatefulWidget {
  const AuditTab({super.key});

  @override
  State<AuditTab> createState() => _AuditTabState();
}

class _AuditTabState extends State<AuditTab> {
  final _desde = TextEditingController();
  final _hasta = TextEditingController();
  int? _usuario;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<AuditProvider>();
      _desde.text = provider.from ?? '';
      _hasta.text = provider.to ?? '';
      setState(() => _usuario = provider.userId);
      provider.loadUsers();
      provider.load(page: 1);
    });
  }

  @override
  void dispose() {
    _desde.dispose();
    _hasta.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AuditProvider>();
    Widget cuerpo;
    if (provider.loading && provider.items.isEmpty) {
      cuerpo = const LoadingState(message: 'Cargando la bitácora...');
    } else if (provider.error != null) {
      cuerpo = ErrorState(message: provider.error!, onRetry: provider.load);
    } else if (provider.items.isEmpty) {
      cuerpo = const EmptyState(
        icon: LucideIcons.shieldCheck,
        title: 'Todavía no hay registros',
      );
    } else {
      cuerpo = Column(
        children: [
          Expanded(
            child: DataTable2(
              columnSpacing: AppSpacing.lg,
              horizontalMargin: AppSpacing.lg,
              minWidth: 800,
              columns: const [
                DataColumn2(label: Text('Fecha y hora'), size: ColumnSize.M),
                DataColumn2(label: Text('Usuario'), size: ColumnSize.M),
                DataColumn2(label: Text('Acción'), size: ColumnSize.L),
                DataColumn2(label: Text('Entidad'), size: ColumnSize.S),
              ],
              rows: [
                for (final e in provider.items)
                  DataRow2(
                    cells: [
                      DataCell(Text(formatDateTime(e.createdAt))),
                      DataCell(Text(e.who, overflow: TextOverflow.ellipsis)),
                      DataCell(
                        Text(
                          auditActionLabel(e.action),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      DataCell(
                        Text(
                          e.entity == null
                              ? '—'
                              : '${e.entity}${e.entityId == null ? '' : ' #${e.entityId}'}',
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const Divider(),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${provider.total} registro${provider.total == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              IconButton(
                tooltip: 'Página anterior',
                onPressed: provider.page > 1
                    ? () => provider.load(page: provider.page - 1)
                    : null,
                icon: const Icon(LucideIcons.chevronLeft, size: 18),
              ),
              Text('${provider.page} de ${provider.totalPages}'),
              IconButton(
                tooltip: 'Página siguiente',
                onPressed: provider.page < provider.totalPages
                    ? () => provider.load(page: provider.page + 1)
                    : null,
                icon: const Icon(LucideIcons.chevronRight, size: 18),
              ),
            ],
          ),
        ],
      );
    }
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 200,
                child: TextField(
                  key: const Key('filtro-desde'),
                  controller: _desde,
                  decoration: const InputDecoration(
                    labelText: 'Desde (AAAA-MM-DD)',
                  ),
                ),
              ),
              SizedBox(
                width: 200,
                child: TextField(
                  key: const Key('filtro-hasta'),
                  controller: _hasta,
                  decoration: const InputDecoration(
                    labelText: 'Hasta (AAAA-MM-DD)',
                  ),
                ),
              ),
              SizedBox(
                width: 240,
                child: DropdownButtonFormField<int?>(
                  key: const Key('filtro-usuario'),
                  isExpanded: true,
                  initialValue: _usuario,
                  decoration: const InputDecoration(labelText: 'Usuario'),
                  items: [
                    const DropdownMenuItem<int?>(
                      value: null,
                      child: Text('Todos los usuarios'),
                    ),
                    for (final u in provider.users)
                      DropdownMenuItem<int?>(
                        value: u.id,
                        child: Text(u.name, overflow: TextOverflow.ellipsis),
                      ),
                  ],
                  onChanged: (valor) => setState(() => _usuario = valor),
                ),
              ),
              FilledButton(
                key: const Key('aplicar-filtros'),
                onPressed: () => provider.setFilters(
                  from: _desde.text,
                  to: _hasta.text,
                  userId: _usuario,
                ),
                child: const Text('Filtrar'),
              ),
              SizedBox(
                width: 280,
                child: DropdownButtonFormField<String?>(
                  key: const Key('filtro-accion'),
                  isExpanded: true,
                  initialValue: provider.action,
                  decoration: const InputDecoration(labelText: 'Acción'),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Todas las acciones'),
                    ),
                    for (final a in auditActions)
                      DropdownMenuItem<String?>(
                        value: a,
                        child: Text(auditActionLabel(a)),
                      ),
                  ],
                  onChanged: provider.setAction,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Expanded(child: cuerpo),
        ],
      ),
    );
  }
}
