import 'package:data_table_2/data_table_2.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/service_type.dart';
import '../providers/service_types_provider.dart';
import '../utils/app_theme.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';

/// Catálogo de tipos de servicio con su intervalo en días y en kilómetros (Sprint 7, solo administrador).
class ServiceTypesTab extends StatefulWidget {
  const ServiceTypesTab({super.key});

  @override
  State<ServiceTypesTab> createState() => _ServiceTypesTabState();
}

class _ServiceTypesTabState extends State<ServiceTypesTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<ServiceTypesProvider>().load();
    });
  }

  Future<void> _abrirFormulario({ServiceType? tipo}) async {
    final guardado = await showDialog<bool>(
      context: context,
      builder: (_) => _TipoDialog(tipo: tipo),
    );
    if (guardado == true && mounted) {
      showFeedback(
        context,
        tipo == null
            ? 'Tipo de servicio creado.'
            : 'Tipo de servicio actualizado.',
      );
    }
  }

  Future<void> _cambiarEstado(ServiceType tipo) async {
    if (tipo.active) {
      final ok = await showConfirmDialog(
        context,
        title: 'Desactivar tipo de servicio',
        message:
            '«${tipo.name}» dejará de ofrecerse en las líneas nuevas. Las órdenes que ya lo usan lo conservan.',
        confirmLabel: 'Desactivar',
        destructive: true,
      );
      if (!ok || !mounted) return;
    }
    final mensaje = await context.read<ServiceTypesProvider>().update(tipo.id, {
      'active': !tipo.active,
    });
    if (mounted && mensaje != null) showFeedback(context, mensaje, error: true);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ServiceTypesProvider>();
    Widget cuerpo;
    if (provider.loading && provider.items.isEmpty) {
      cuerpo = const LoadingState(message: 'Cargando los tipos de servicio...');
    } else if (provider.error != null) {
      cuerpo = ErrorState(message: provider.error!, onRetry: provider.load);
    } else if (provider.items.isEmpty) {
      cuerpo = EmptyState(
        icon: LucideIcons.wrench,
        title: 'Todavía no hay tipos de servicio',
        message: 'Crea el primero para proponer el próximo mantenimiento con su intervalo.',
        actionLabel: 'Nuevo tipo',
        onAction: _abrirFormulario,
      );
    } else {
      cuerpo = DataTable2(
        columnSpacing: AppSpacing.lg,
        horizontalMargin: AppSpacing.lg,
        minWidth: 700,
        columns: const [
          DataColumn2(label: Text('Nombre'), size: ColumnSize.L),
          DataColumn2(label: Text('Intervalo'), size: ColumnSize.M),
          DataColumn2(label: Text('Estado'), size: ColumnSize.S),
          DataColumn2(label: Text('Acciones'), fixedWidth: 130),
        ],
        rows: [
          for (final t in provider.items)
            DataRow2(
              cells: [
                DataCell(Text(t.name, overflow: TextOverflow.ellipsis)),
                DataCell(Text(t.intervalLabel)),
                DataCell(StatusChip.active(t.active)),
                DataCell(
                  Row(
                    children: [
                      IconButton(
                        key: Key('editar-tipo-${t.id}'),
                        tooltip: 'Editar',
                        onPressed: () => _abrirFormulario(tipo: t),
                        icon: const Icon(LucideIcons.pencil, size: 18),
                      ),
                      IconButton(
                        key: Key('estado-tipo-${t.id}'),
                        tooltip: t.active ? 'Desactivar' : 'Activar',
                        onPressed: () => _cambiarEstado(t),
                        icon: Icon(
                          t.active ? LucideIcons.eyeOff : LucideIcons.eye,
                          size: 18,
                        ),
                      ),
                    ],
                  ),
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
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              key: const Key('nuevo-tipo'),
              onPressed: () => _abrirFormulario(),
              icon: const Icon(LucideIcons.plus, size: 18),
              label: const Text('Nuevo tipo'),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Expanded(child: cuerpo),
        ],
      ),
    );
  }
}

class _TipoDialog extends StatefulWidget {
  const _TipoDialog({this.tipo});

  final ServiceType? tipo;

  @override
  State<_TipoDialog> createState() => _TipoDialogState();
}

class _TipoDialogState extends State<_TipoDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nombre = TextEditingController(
    text: widget.tipo?.name ?? '',
  );
  late final TextEditingController _dias = TextEditingController(
    text: widget.tipo?.intervalDays?.toString() ?? '',
  );
  late final TextEditingController _km = TextEditingController(
    text: widget.tipo?.intervalKm?.toString() ?? '',
  );
  String? _error;
  bool _guardando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _dias.dispose();
    _km.dispose();
    super.dispose();
  }

  String? _opcional(String? v, int max, String etiqueta) {
    final t = (v ?? '').trim();
    if (t.isEmpty) return null;
    final n = int.tryParse(t);
    if (n == null || n < 1 || n > max) {
      return '$etiqueta debe ser un número entero de 1 a $max.';
    }
    return null;
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    final dias = int.tryParse(_dias.text.trim());
    final km = int.tryParse(_km.text.trim());
    if (dias == null && km == null) {
      setState(
        () => _error = 'Indica el intervalo en días, en kilómetros o en ambos.',
      );
      return;
    }
    setState(() {
      _guardando = true;
      _error = null;
    });
    final provider = context.read<ServiceTypesProvider>();
    final mensaje = widget.tipo == null
        ? await provider.create(name: _nombre.text.trim(), days: dias, km: km)
        : await provider.update(widget.tipo!.id, {
            'name': _nombre.text.trim(),
            'intervalDays': dias,
            'intervalKm': km,
          });
    if (!mounted) return;
    if (mensaje == null) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _guardando = false;
        _error = mensaje;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.tipo == null
            ? 'Nuevo tipo de servicio'
            : 'Editar tipo de servicio',
      ),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                key: const Key('campo-nombre-tipo'),
                controller: _nombre,
                maxLength: 100,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Nombre'),
                validator: (v) => (v ?? '').trim().isEmpty
                    ? 'El nombre es obligatorio.'
                    : null,
              ),
              TextFormField(
                key: const Key('campo-dias-tipo'),
                controller: _dias,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Intervalo en días (opcional)',
                ),
                validator: (v) => _opcional(v, 3650, 'El intervalo en días'),
              ),
              TextFormField(
                key: const Key('campo-km-tipo'),
                controller: _km,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Intervalo en kilómetros (opcional)',
                ),
                validator: (v) =>
                    _opcional(v, 1000000, 'El intervalo en kilómetros'),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _error!,
                  key: const Key('error-tipo'),
                  style: const TextStyle(color: AppColors.danger),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(
          onPressed: _guardando ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('guardar-tipo'),
          onPressed: _guardando ? null : _guardar,
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}
