import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/client.dart';
import '../../models/vehicle.dart';
import '../../providers/auth_provider.dart';
import '../../providers/clients_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../vehicles/vehicle_form_screen.dart';

/// Detalle de un cliente con sus datos y los vehículos asociados.
class ClientDetailScreen extends StatefulWidget {
  const ClientDetailScreen({super.key, required this.clientId});

  final int clientId;

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ClientsProvider>().loadDetail(widget.clientId);
    });
  }

  Future<void> _edit(Client client) async {
    final Object? guardado = await Navigator.of(context).pushNamed(
      AppRoutes.clientForm,
      arguments: client,
    );
    if (guardado == true && mounted) {
      context.read<ClientsProvider>().loadDetail(widget.clientId);
    }
  }

  Future<void> _addVehicle(Client client) async {
    final Object? creado = await Navigator.of(context).pushNamed(
      AppRoutes.vehicleForm,
      arguments: VehicleFormArgs(
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
      ),
    );
    if (creado == true && mounted) {
      context.read<ClientsProvider>().loadDetail(widget.clientId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ClientsProvider provider = context.watch<ClientsProvider>();
    final bool canWrite = context.watch<AuthProvider>().role?.canManageRecords ?? false;
    final Client? client = provider.detail;

    Widget body;
    if (provider.detailLoading || (client == null && provider.detailError == null)) {
      body = const LoadingView();
    } else if (client == null) {
      body = ErrorStateView(
        message: provider.detailError ?? 'No se pudo cargar el cliente.',
        onRetry: () => provider.loadDetail(widget.clientId),
      );
    } else {
      body = _Content(
        client: client,
        canWrite: canWrite,
        onEdit: () => _edit(client),
        onAddVehicle: () => _addVehicle(client),
      );
    }

    return AppShell(
      currentRoute: AppRoutes.clients,
      title: 'Detalle del cliente',
      child: body,
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({
    required this.client,
    required this.canWrite,
    required this.onEdit,
    required this.onAddVehicle,
  });

  final Client client;
  final bool canWrite;
  final VoidCallback onEdit;
  final VoidCallback onAddVehicle;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              IconButton(
                tooltip: 'Volver',
                icon: const Icon(LucideIcons.arrowLeft, size: 20),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(client.name, style: text.headlineMedium)),
              if (canWrite)
                OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(LucideIcons.pencil, size: 18),
                  label: const Text('Editar'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          Panel(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              children: <Widget>[
                DetailRow(label: 'Teléfono', value: client.phone),
                DetailRow(label: 'Correo electrónico', value: Format.orDash(client.email)),
                DetailRow(label: 'Dirección', value: Format.orDash(client.address)),
                DetailRow(label: 'Fecha de registro', value: Format.date(client.createdAt)),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: <Widget>[
              Text('Vehículos', style: text.titleMedium),
              const SizedBox(width: AppSpacing.sm),
              Text('(${client.vehicles.length})', style: text.bodySmall),
              const Spacer(),
              ..._vehicleActions(context),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Panel(
            child: client.vehicles.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(AppSpacing.xl),
                    child: Text('Este cliente aún no tiene vehículos registrados.'),
                  )
                : _VehiclesTable(vehicles: client.vehicles),
          ),
        ],
      ),
    );
  }

  /// Acciones junto al título de vehículos: "Agregar vehículo" con este cliente como propietario.
  List<Widget> _vehicleActions(BuildContext context) => <Widget>[
        if (canWrite)
          FilledButton.icon(
            onPressed: onAddVehicle,
            icon: const Icon(LucideIcons.plus, size: 18),
            label: const Text('Agregar vehículo'),
          ),
      ];
}

class _VehiclesTable extends StatelessWidget {
  const _VehiclesTable({required this.vehicles});

  final List<Vehicle> vehicles;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: DataTable(
        showCheckboxColumn: false,
        columns: const <DataColumn>[
          DataColumn(label: Text('Placa')),
          DataColumn(label: Text('Vehículo')),
          DataColumn(label: Text('Año')),
          DataColumn(label: Text('Kilometraje')),
        ],
        rows: <DataRow>[
          for (final Vehicle v in vehicles)
            DataRow(
              onSelectChanged: (_) => Navigator.of(context).pushNamed(
                AppRoutes.vehicleDetail,
                arguments: v.id,
              ),
              cells: <DataCell>[
                DataCell(Text(v.licensePlate)),
                DataCell(Text(v.title)),
                DataCell(Text('${v.year}')),
                DataCell(Text(Format.mileage(v.currentMileage))),
              ],
            ),
        ],
      ),
    );
  }
}
