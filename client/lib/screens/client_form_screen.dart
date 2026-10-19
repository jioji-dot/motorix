import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/client.dart';
import '../providers/clients_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

/// Alta y edición de un cliente. Devuelve `true` al guardar.
class ClientFormScreen extends StatefulWidget {
  const ClientFormScreen({super.key, this.client});

  /// Si se indica, el formulario edita ese cliente.
  final Client? client;

  @override
  State<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends State<ClientFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  bool _saving = false;
  String? _error;

  bool get _editing => widget.client != null;

  bool get _dirty =>
      _name.text != (widget.client?.name ?? '') ||
      _phone.text != (widget.client?.phone ?? '') ||
      _email.text != (widget.client?.email ?? '');

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.client?.name ?? '');
    _phone = TextEditingController(text: widget.client?.phone ?? '');
    _email = TextEditingController(text: widget.client?.email ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Map<String, dynamic> _datos({bool confirmarTelefono = false}) => {
        'name': _name.text.trim(),
        'phone': _phone.text.replaceAll(RegExp(r'[\s\-().]'), ''),
        'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
        if (confirmarTelefono) 'confirmDuplicatePhone': true,
      };

  Future<void> _save({bool confirmarTelefono = false}) async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final provider = context.read<ClientsProvider>();
    try {
      if (_editing) {
        await provider.update(widget.client!.id, _datos(confirmarTelefono: confirmarTelefono));
      } else {
        await provider.create(_datos(confirmarTelefono: confirmarTelefono));
      }
      if (!mounted) return;
      showFeedback(context, _editing ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == 'DUPLICATE_PHONE') {
        setState(() => _saving = false);
        final nombres = e.details.map((d) => d['name']).join(', ');
        final continuar = await showConfirmDialog(
          context,
          title: 'Teléfono repetido',
          message: 'Ya existe un cliente con ese teléfono: $nombres. ¿Quieres guardarlo de todos modos?',
        );
        if (continuar && mounted) await _save(confirmarTelefono: true);
        return;
      }
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final salir = await confirmDiscardChanges(context);
        if (salir && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_editing ? 'Editar cliente' : 'Registrar cliente'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: Align(
          alignment: Alignment.topCenter,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Form(
                key: _formKey,
                onChanged: () => setState(() {}),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('campo-nombre'),
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Nombre completo'),
                      validator: (v) {
                        final texto = (v ?? '').trim();
                        if (texto.isEmpty) return 'El nombre es obligatorio.';
                        if (texto.length > 120) return 'El nombre no puede tener más de 120 caracteres.';
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-telefono'),
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'Teléfono (10 dígitos)'),
                      validator: (v) => RegExp(r'^\d{10}$').hasMatch((v ?? '').replaceAll(RegExp(r'[\s\-().]'), ''))
                          ? null
                          : 'El teléfono debe tener 10 dígitos.',
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-correo'),
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Correo electrónico (opcional)'),
                      validator: (v) {
                        final valor = (v ?? '').trim();
                        if (valor.isEmpty) return null;
                        return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(valor)
                            ? null
                            : 'El correo no tiene un formato válido.';
                      },
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(_error!, style: texto.bodyMedium?.copyWith(color: AppColors.danger)),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton(
                          onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                          child: const Text('Cancelar'),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        FilledButton(
                          onPressed: _saving ? null : () => _save(),
                          child: _saving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Guardar'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
