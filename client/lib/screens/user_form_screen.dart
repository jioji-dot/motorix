import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/user.dart';
import '../providers/users_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/button_spinner.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';
import 'change_password_screen.dart';

/// Alta y edición de un usuario (solo ADMIN). Devuelve `true` al guardar.
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({super.key, this.user});

  /// Si se indica, el formulario edita ese usuario (el nombre de usuario no se cambia).
  final User? user;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _username;
  late final TextEditingController _name;
  late final TextEditingController _email;
  final _password = TextEditingController();
  UserRole? _role;
  bool _saving = false;
  String? _error;

  bool get _editing => widget.user != null;

  bool get _dirty =>
      _username.text != (widget.user?.username ?? '') ||
      _name.text != (widget.user?.name ?? '') ||
      _email.text != (widget.user?.email ?? '') ||
      _role != widget.user?.role ||
      _password.text.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _username = TextEditingController(text: widget.user?.username ?? '');
    _name = TextEditingController(text: widget.user?.name ?? '');
    _email = TextEditingController(text: widget.user?.email ?? '');
    _role = widget.user?.role;
  }

  @override
  void dispose() {
    _username.dispose();
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final provider = context.read<UsersProvider>();
    try {
      if (_editing) {
        await provider.update(widget.user!.id, {
          'name': _name.text.trim(),
          'email': _email.text.trim(),
          'role': _role!.value,
          if (_password.text.isNotEmpty) 'password': _password.text,
        });
      } else {
        await provider.create({
          'username': _username.text.trim(),
          'name': _name.text.trim(),
          'email': _email.text.trim(),
          'role': _role!.value,
          'password': _password.text,
        });
      }
      if (!mounted) return;
      showFeedback(context, _editing ? 'Usuario actualizado correctamente.' : 'Usuario registrado correctamente.');
      Navigator.of(context).pop(true);
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
          title: Text(_editing ? 'Editar usuario' : 'Registrar usuario'),
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
                      key: const Key('campo-usuario'),
                      controller: _username,
                      enabled: !_editing,
                      decoration: const InputDecoration(labelText: 'Nombre de usuario'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.length < 3) return 'El nombre de usuario debe tener al menos 3 caracteres.';
                        if (t.length > 50) return 'El nombre de usuario no puede tener más de 50 caracteres.';
                        if (RegExp(r'\s').hasMatch(t)) return 'El nombre de usuario no puede tener espacios.';
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-nombre'),
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Nombre completo'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return 'El nombre es obligatorio.';
                        if (t.length > 120) return 'El nombre no puede tener más de 120 caracteres.';
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-correo'),
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: 'Correo electrónico'),
                      validator: (v) {
                        final t = (v ?? '').trim();
                        if (t.isEmpty) return 'El correo es obligatorio.';
                        return RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(t)
                            ? null
                            : 'El correo no tiene un formato válido.';
                      },
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    DropdownButtonFormField<UserRole>(
                      key: const Key('campo-rol'),
                      initialValue: _role,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Rol'),
                      items: [
                        for (final rol in UserRole.values) DropdownMenuItem(value: rol, child: Text(rol.label)),
                      ],
                      onChanged: (valor) => setState(() => _role = valor),
                      validator: (v) => v == null ? 'Elige un rol.' : null,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    TextFormField(
                      key: const Key('campo-contrasena-usuario'),
                      controller: _password,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: _editing ? 'Restablecer contraseña (opcional)' : 'Contraseña inicial',
                      ),
                      validator: (v) {
                        if (_editing && (v ?? '').isEmpty) return null;
                        return validarPoliticaContrasena(v);
                      },
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.',
                      style: texto.bodySmall,
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
