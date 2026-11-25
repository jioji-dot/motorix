import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/settings_provider.dart';
import '../utils/app_theme.dart';
import '../widgets/button_spinner.dart';
import '../widgets/state_views.dart';
import 'audit_tab.dart';
import 'service_types_tab.dart';
import 'terms_admin_tab.dart';

/// Configuración del taller (solo administrador): datos del ticket y márgenes de «Próximo», tipos de servicio, términos y bitácora.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: const [
          TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              Tab(text: 'Taller'),
              Tab(text: 'Tipos de servicio'),
              Tab(text: 'Términos'),
              Tab(text: 'Bitácora'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                WorkshopTab(),
                ServiceTypesTab(),
                TermsAdminTab(),
                AuditTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Datos del taller del ticket y márgenes de «Próximo».
class WorkshopTab extends StatefulWidget {
  const WorkshopTab({super.key});

  @override
  State<WorkshopTab> createState() => _WorkshopTabState();
}

class _WorkshopTabState extends State<WorkshopTab> {
  final _formKey = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _direccion = TextEditingController();
  final _telefono = TextEditingController();
  final _dias = TextEditingController();
  final _km = TextEditingController();
  bool _cargado = false;
  bool _guardando = false;
  String? _error;
  List<String> _iniciales = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SettingsProvider>().load();
    });
    for (final c in [_nombre, _direccion, _telefono, _dias, _km]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final c in [_nombre, _direccion, _telefono, _dias, _km]) {
      c.dispose();
    }
    super.dispose();
  }

  List<String> get _actuales => [
    _nombre.text,
    _direccion.text,
    _telefono.text,
    _dias.text,
    _km.text,
  ].map((t) => t.trim()).toList();
  bool get _hayCambios =>
      _cargado && _actuales.join('\u0001') != _iniciales.join('\u0001');

  void _llenar(SettingsProvider p) {
    final d = p.data;
    if (d == null || _cargado) return;
    _nombre.text = d.workshopName;
    _direccion.text = d.workshopAddress;
    _telefono.text = d.workshopPhone;
    _dias.text = '${d.warnDays}';
    _km.text = '${d.warnKm}';
    _iniciales = _actuales;
    _cargado = true;
  }

  String? _entero(String? v, int min, int max, String etiqueta) {
    final n = int.tryParse((v ?? '').trim());
    if (n == null || n < min || n > max) {
      return '$etiqueta debe ser un número entero de $min a $max.';
    }
    return null;
  }

  Future<void> _guardar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _guardando = true;
      _error = null;
    });
    final mensaje = await context.read<SettingsProvider>().save(
      workshop: {
        'name': _nombre.text.trim(),
        'address': _direccion.text.trim(),
        'phone': _telefono.text.trim(),
      },
      maintenance: {
        'warnDays': int.parse(_dias.text.trim()),
        'warnKm': int.parse(_km.text.trim()),
      },
    );
    if (!mounted) return;
    setState(() {
      _guardando = false;
      _error = mensaje;
      if (mensaje == null) _iniciales = _actuales;
    });
    if (mensaje == null) showFeedback(context, 'Configuración guardada.');
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SettingsProvider>();
    _llenar(provider);
    if (provider.loading && provider.data == null) {
      return const LoadingState(message: 'Cargando la configuración...');
    }
    if (provider.error != null && provider.data == null) {
      return ErrorState(message: provider.error!, onRetry: provider.load);
    }
    final texto = Theme.of(context).textTheme;
    final d = provider.data;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Datos del taller en el ticket', style: texto.titleMedium),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  key: const Key('campo-nombre-taller'),
                  controller: _nombre,
                  maxLength: 120,
                  decoration: const InputDecoration(
                    labelText: 'Nombre del taller',
                  ),
                  validator: (v) => (v ?? '').trim().isEmpty
                      ? 'El nombre del taller es obligatorio.'
                      : null,
                ),
                TextFormField(
                  key: const Key('campo-direccion-taller'),
                  controller: _direccion,
                  maxLength: 200,
                  decoration: const InputDecoration(labelText: 'Dirección'),
                ),
                TextFormField(
                  key: const Key('campo-telefono-taller'),
                  controller: _telefono,
                  maxLength: 30,
                  decoration: const InputDecoration(labelText: 'Teléfono'),
                ),
                const SizedBox(height: AppSpacing.xl),
                Text('Márgenes de «Próximo»', style: texto.titleMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Un mantenimiento es Próximo cuando faltan estos días o estos kilómetros.',
                  style: texto.bodySmall,
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  key: const Key('campo-dias-margen'),
                  controller: _dias,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Días'),
                  validator: (v) => _entero(v, 1, 365, 'Los días de margen'),
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  key: const Key('campo-km-margen'),
                  controller: _km,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Kilómetros'),
                  validator: (v) =>
                      _entero(v, 1, 100000, 'Los kilómetros de margen'),
                ),
                if (d != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Valores predeterminados: ${d.defaultWarnDays} días y ${d.defaultWarnKm} km.',
                    style: texto.bodySmall,
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    _error!,
                    key: const Key('error-configuracion'),
                    style: texto.bodyMedium?.copyWith(color: AppColors.danger),
                  ),
                ],
                const SizedBox(height: AppSpacing.xl),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton(
                    key: const Key('guardar-configuracion'),
                    onPressed: (_hayCambios && !_guardando) ? _guardar : null,
                    child: _guardando
                        ? const ButtonSpinner()
                        : const Text('Guardar'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
