import 'dart:async';

import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/maintenance.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/maintenance_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/list_toolbar.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'maintenance_form_screen.dart';

/// Filtros de clasificación: valor de la API y etiqueta.
const _filtros = <(String?, String)>[
  (null, 'Todos los pendientes'),
  ('VENCIDO,PROXIMO', 'Próximos y vencidos'),
  ('VENCIDO', 'Vencidos'),
  ('PROXIMO', 'Próximos'),
  ('NORMAL', 'Normales'),
];

/// Cuánto falta (o cuánto se pasó) de un mantenimiento, en días y/o kilómetros.
String restanteDe(Maintenance m) {
  final partes = <String>[];
  final dias = m.daysLeft;
  if (dias != null) {
    partes.add(dias < 0
        ? 'Hace ${-dias} día${dias == -1 ? '' : 's'}'
        : (dias == 0 ? 'Hoy' : 'En $dias día${dias == 1 ? '' : 's'}'));
  }
  final km = m.kmLeft;
  if (km != null) {
    partes.add(km < 0 ? 'Pasado por ${formatMileage(-km)}' : 'Faltan ${formatMileage(km)}');
  }
  return partes.isEmpty ? '—' : partes.join(' · ');
}

/// Mantenimientos programados: pendientes clasificados por urgencia, con el contacto del cliente.
/// Mecánico y administrador programan y editan; recepción solo consulta.
class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<MaintenanceProvider>().load(page: 1);
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
      if (mounted) context.read<MaintenanceProvider>().setSearch(valor);
    });
  }

  Future<void> _openForm({Maintenance? maintenance}) async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => MaintenanceFormScreen(maintenance: maintenance)),
    );
    if (guardado == true && mounted) context.read<MaintenanceProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MaintenanceProvider>();
    final puedeEscribir = context.select<AuthProvider, bool>(
      (a) => a.role == UserRole.admin || a.role == UserRole.mechanic,
    );

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
                hintText: 'Buscar por cliente, placas o tipo de servicio',
                prefixIcon: Icon(LucideIcons.search, size: 18),
              ),
            ),
            actions: [
              SizedBox(
                width: 220,
                child: DropdownButtonFormField<String?>(
                  key: const Key('filtro-clasificacion'),
                  isExpanded: true,
                  initialValue: provider.classificationFilter,
                  decoration: const InputDecoration(labelText: 'Mostrar'),
                  items: [
                    for (final (valor, etiqueta) in _filtros)
                      DropdownMenuItem<String?>(value: valor, child: Text(etiqueta, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (valor) => context.read<MaintenanceProvider>().setClassificationFilter(valor),
                ),
              ),
              if (puedeEscribir)
                FilledButton(
                  onPressed: () => _openForm(),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.plus, size: 18),
                      SizedBox(width: AppSpacing.sm),
                      Flexible(child: Text('Programar mantenimiento', overflow: TextOverflow.ellipsis)),
                    ],
                  ),
                ),
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

  Widget _buildBody(MaintenanceProvider provider, bool puedeEscribir) {
    if (provider.loading && provider.items.isEmpty) return const LoadingState(message: 'Cargando mantenimientos...');
    if (provider.error != null) return ErrorState(message: provider.error!, onRetry: provider.load);

    if (provider.items.isEmpty) {
      final filtrando = provider.search.trim().isNotEmpty || provider.classificationFilter != null;
      return EmptyState(
        icon: LucideIcons.wrench,
        title: filtrando ? 'No se encontraron mantenimientos' : 'No hay mantenimientos pendientes',
        message: filtrando
            ? 'Prueba con otra búsqueda o cambia el filtro.'
            : 'Los mantenimientos que programes aparecerán aquí.',
        actionLabel: (!filtrando && puedeEscribir) ? 'Programar mantenimiento' : null,
        onAction: (!filtrando && puedeEscribir) ? () => _openForm() : null,
      );
    }

    return Column(
      children: [
        Expanded(
          child: DataTable2(
            columnSpacing: AppSpacing.lg,
            horizontalMargin: AppSpacing.lg,
            minWidth: 1100,
            showCheckboxColumn: false,
            columns: const [
              DataColumn2(label: Text('Estado'), size: ColumnSize.S),
              DataColumn2(label: Text('Cliente'), size: ColumnSize.M),
              DataColumn2(label: Text('Teléfono'), size: ColumnSize.S),
              DataColumn2(label: Text('Vehículo'), size: ColumnSize.M),
              DataColumn2(label: Text('Servicio'), size: ColumnSize.M),
              DataColumn2(label: Text('Próximo'), size: ColumnSize.M),
              DataColumn2(label: Text('Restante'), size: ColumnSize.M),
              DataColumn2(label: Text('Acciones'), fixedWidth: 90),
            ],
            rows: [
              for (final m in provider.items)
                DataRow2(
                  onTap: (puedeEscribir && m.isPending) ? () => _openForm(maintenance: m) : null,
                  cells: [
                    DataCell(StatusChip.maintenance(m.classification)),
                    DataCell(Text(m.clientName, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(m.clientPhone == null ? '—' : formatPhone(m.clientPhone!), overflow: TextOverflow.ellipsis)),
                    DataCell(Text('${m.licensePlate} · ${m.vehicleTitle}', overflow: TextOverflow.ellipsis)),
                    DataCell(Text(m.serviceType, overflow: TextOverflow.ellipsis)),
                    DataCell(Text(
                      [
                        if (m.nextDate != null) formatDate(m.nextDate),
                        if (m.nextMileage != null) formatMileage(m.nextMileage!),
                      ].join(' · '),
                      overflow: TextOverflow.ellipsis,
                    )),
                    DataCell(Text(restanteDe(m), overflow: TextOverflow.ellipsis)),
                    DataCell(
                      (puedeEscribir && m.isPending)
                          ? IconButton(
                              tooltip: 'Editar',
                              onPressed: () => _openForm(maintenance: m),
                              icon: const Icon(LucideIcons.pencil, size: 18),
                            )
                          : const SizedBox.shrink(),
                    ),
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
                  '${provider.total} mantenimiento${provider.total == 1 ? '' : 's'}',
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
                onPressed: provider.page < provider.totalPages ? () => provider.load(page: provider.page + 1) : null,
                icon: const Icon(LucideIcons.chevronRight, size: 18),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
