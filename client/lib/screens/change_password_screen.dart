import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/button_spinner.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

/// Política mínima de contraseña: 8 caracteres, mayúscula, minúscula y número.
String? validarPoliticaContrasena(String? valor) {
  final texto = valor ?? '';
  if (texto.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!RegExp('[A-Z]').hasMatch(texto)) return 'La contraseña debe incluir al menos una mayúscula.';
  if (!RegExp('[a-z]').hasMatch(texto)) return 'La contraseña debe incluir al menos una minúscula.';
  if (!RegExp(r'\d').hasMatch(texto)) return 'La contraseña debe incluir al menos un número.';
  return null;
}

/// Cambio de contraseña del usuario actual.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;
  String? _error;

  bool get _dirty => _current.text.isNotEmpty || _new.text.isNotEmpty || _confirm.text.isNotEmpty;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().changePassword(_current.text, _new.text);
      if (!mounted) return;
      _current.clear();
      _new.clear();
      _confirm.clear();
      showFeedback(context, 'Tu contraseña se actualizó correctamente.');
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
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
          title: const Text('Cambiar contraseña'),
          backgroundColor: AppColors.surface,
          scrolledUnderElevation: 0,
        ),
        body: Align(
          alignment: Alignment.topCenter,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                onChanged: () => setState(() {}),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('campo-contrasena-actual'),
                      controller: _current,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Contraseña actual'),
                      validator: (v) => (v == null || v.isEmpty) ? 'Ingresa tu contraseña actual.' : null,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-contrasena-nueva'),
                      controller: _new,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Contraseña nueva'),
                      validator: validarPoliticaContrasena,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.',
                      style: texto.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-contrasena-confirmacion'),
                      controller: _confirm,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Confirmar contraseña nueva'),
                      validator: (v) => v != _new.text ? 'Las contraseñas no coinciden.' : null,
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
                          onPressed: _saving ? null : _save,
                          child: _saving
                              ? const ButtonSpinner()
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
