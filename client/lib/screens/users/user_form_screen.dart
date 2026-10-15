import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/users_provider.dart';
import '../../services/users_service.dart';
import '../../utils/app_theme.dart';
import '../../utils/validators.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Formulario de usuario: alta (sin [user]) o edición (con [user]). Solo ADMIN.
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({super.key, this.user});

  final AppUser? user;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _username;
  late final TextEditingController _name;
  late final TextEditingController _email;
  final TextEditingController _password = TextEditingController();
  final TextEditingController _confirm = TextEditingController();

  late UserRole _role;
  late bool _active;
  bool _saving = false;
  bool _allowPop = false;
  Map<String, String> _serverErrors = <String, String>{};

  AppUser? get _user => widget.user;
  bool get _isEdit => _user != null;

  @override
  void initState() {
    super.initState();
    final AppUser? u = _user;
    _username = TextEditingController(text: u?.username ?? '');
    _name = TextEditingController(text: u?.name ?? '');
    _email = TextEditingController(text: u?.email ?? '');
    _role = u?.role ?? UserRole.receptionist;
    _active = u?.active ?? true;
  }

  @override
  void dispose() {
    _username.dispose();
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _dirty {
    final AppUser? u = _user;
    if (u == null) {
      return _username.text.isNotEmpty ||
          _name.text.isNotEmpty ||
          _email.text.isNotEmpty ||
          _password.text.isNotEmpty ||
          _confirm.text.isNotEmpty ||
          _role != UserRole.receptionist;
    }
    return _name.text != u.name || _email.text != u.email || _role != u.role || _active != u.active;
  }

  Future<void> _save() async {
    setState(() => _serverErrors = <String, String>{});
    if (!(_formKey.currentState?.validate() ?? false)) return;

    if (_isEdit && _user!.active && !_active) {
      final bool confirmar = await showConfirmDialog(
        context,
        title: 'Desactivar usuario',
        message: confirmationText('desactivar la cuenta de ${_user!.name}', irreversible: false),
      );
      if (!confirmar || !mounted) return;
    }

    setState(() => _saving = true);
    final UsersProvider provider = context.read<UsersProvider>();
    try {
      if (_isEdit) {
        await provider.update(
          _user!.id,
          UserChanges(
            name: _name.text.trim(),
            email: _email.text.trim(),
            role: _role,
            active: _active,
          ),
        );
      } else {
        await provider.create(NewUserInput(
          username: _username.text.trim(),
          name: _name.text.trim(),
          email: _email.text.trim(),
          role: _role,
          password: _password.text,
        ));
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        _isEdit ? 'Usuario actualizado correctamente.' : 'Usuario registrado correctamente.',
      );
      setState(() => _allowPop = true);
      Navigator.of(context).pop(true);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      _handleError(error);
    }
  }

  void _handleError(ApiError error) {
    switch (error.code) {
      case 'DUPLICATE_USERNAME':
        setState(() => _serverErrors = <String, String>{'username': error.message});
      case 'DUPLICATE_EMAIL':
        setState(() => _serverErrors = <String, String>{'email': error.message});
      case 'VALIDATION_ERROR' when error.details is List:
        final Map<String, String> campos = <String, String>{};
        for (final dynamic d in error.details as List<dynamic>) {
          if (d is Map && d['field'] != null) {
            campos[d['field'] as String] = d['message'] as String;
          }
        }
        setState(() => _serverErrors = campos);
      default:
        showAppSnackBar(context, error.message, isError: true);
    }
  }

  Future<void> _resetPassword() async {
    final bool? hecho = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext contexto) => _ResetPasswordDialog(user: _user!),
    );
    if (hecho == true && mounted) {
      showAppSnackBar(context, 'Contraseña restablecida correctamente.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isSelf = _isEdit && _user!.id == context.watch<AuthProvider>().user?.id;

    return PopScope(
      canPop: _allowPop || !_dirty,
      onPopInvokedWithResult: (bool didPop, Object? result) async {
        if (didPop) return;
        final bool salir = await showConfirmDialog(
          context,
          title: 'Salir sin guardar',
          message: '¿Seguro que quieres salir? Los cambios sin guardar se perderán.',
        );
        if (salir && context.mounted) {
          setState(() => _allowPop = true);
          Navigator.of(context).pop();
        }
      },
      child: AppShell(
        currentRoute: AppRoutes.users,
        title: _isEdit ? 'Editar usuario' : 'Nuevo usuario',
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Align(
            alignment: Alignment.topLeft,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Panel(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Form(
                  key: _formKey,
                  onChanged: () => setState(() {}),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      TextFormField(
                        controller: _username,
                        enabled: !_isEdit && !_saving,
                        decoration: InputDecoration(
                          labelText: 'Usuario *',
                          helperText: _isEdit ? 'El usuario no se puede modificar.' : null,
                          errorText: _serverErrors['username'],
                        ),
                        validator: Validators.username,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _name,
                        enabled: !_saving,
                        decoration: InputDecoration(
                          labelText: 'Nombre *',
                          errorText: _serverErrors['name'],
                        ),
                        validator: (String? v) =>
                            Validators.required(v, 'el nombre') ?? Validators.maxLength(v, 100),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _email,
                        enabled: !_saving,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: 'Correo electrónico *',
                          errorText: _serverErrors['email'],
                        ),
                        validator: (String? v) => Validators.email(v, obligatorio: true),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      DropdownButtonFormField<UserRole>(
                        initialValue: _role,
                        decoration: InputDecoration(
                          labelText: 'Rol *',
                          errorText: _serverErrors['role'],
                        ),
                        items: <DropdownMenuItem<UserRole>>[
                          for (final UserRole r in UserRole.values)
                            DropdownMenuItem<UserRole>(value: r, child: Text(r.label)),
                        ],
                        onChanged: (_saving || isSelf)
                            ? null
                            : (UserRole? r) => setState(() => _role = r ?? _role),
                      ),
                      if (!_isEdit) ...<Widget>[
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _password,
                          enabled: !_saving,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: 'Contraseña *',
                            helperText: Validators.mensajePoliticaContrasena,
                            helperMaxLines: 2,
                            errorText: _serverErrors['password'],
                          ),
                          validator: Validators.password,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        TextFormField(
                          controller: _confirm,
                          enabled: !_saving,
                          obscureText: true,
                          decoration: const InputDecoration(labelText: 'Confirmar contraseña *'),
                          validator: (String? v) =>
                              v == _password.text ? null : 'Las contraseñas no coinciden.',
                        ),
                      ],
                      if (_isEdit) ...<Widget>[
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text('Cuenta activa',
                                      style: Theme.of(context).textTheme.bodyLarge),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    isSelf
                                        ? 'No puedes desactivar tu propia cuenta ni cambiar tu propio rol.'
                                        : 'Una cuenta inactiva no puede iniciar sesión.',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            Switch(
                              value: _active,
                              onChanged:
                                  (_saving || isSelf) ? null : (bool v) => setState(() => _active = v),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        if (!isSelf)
                          Align(
                            alignment: Alignment.centerLeft,
                            child: OutlinedButton(
                              onPressed: _saving ? null : _resetPassword,
                              child: const Text('Restablecer contraseña'),
                            ),
                          ),
                      ],
                      const SizedBox(height: AppSpacing.xl),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: <Widget>[
                          OutlinedButton(
                            onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
                            child: const Text('Cancelar'),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          FilledButton(
                            onPressed: _saving ? null : _save,
                            child: _saving
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.onPrimary,
                                    ),
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
      ),
    );
  }
}

/// Cuadro para que el administrador defina una contraseña nueva a otro usuario.
class _ResetPasswordDialog extends StatefulWidget {
  const _ResetPasswordDialog({required this.user});

  final AppUser user;

  @override
  State<_ResetPasswordDialog> createState() => _ResetPasswordDialogState();
}

class _ResetPasswordDialogState extends State<_ResetPasswordDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _new = TextEditingController();
  final TextEditingController _confirm = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final NavigatorState navigator = Navigator.of(context);
    try {
      await context.read<UsersProvider>().resetPassword(widget.user.id, _new.text);
      navigator.pop(true);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.fieldMessage('newPassword') ?? error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Restablecer contraseña'),
      content: SizedBox(
        width: 380,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text('Define una contraseña nueva para ${widget.user.name}.'),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _new,
                obscureText: true,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Contraseña nueva',
                  helperText: Validators.mensajePoliticaContrasena,
                  helperMaxLines: 2,
                ),
                validator: Validators.password,
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _confirm,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirmar contraseña nueva'),
                validator: (String? v) => v == _new.text ? null : 'Las contraseñas no coinciden.',
                onFieldSubmitted: (_) => _submit(),
              ),
              if (_error != null) ...<Widget>[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  _error!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.danger),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: <Widget>[
        OutlinedButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: const Text('Restablecer'),
        ),
      ],
    );
  }
}
