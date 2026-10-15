import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/api_error.dart';
import '../providers/auth_provider.dart';
import '../utils/app_theme.dart';
import '../utils/validators.dart';

/// Abre el cuadro para cambiar la contraseña de la cuenta actual.
Future<void> showChangePasswordDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (BuildContext contexto) => const ChangePasswordDialog(),
  );
}

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key});

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _current = TextEditingController();
  final TextEditingController _new = TextEditingController();
  final TextEditingController _confirm = TextEditingController();
  bool _saving = false;
  String? _currentError;
  String? _generalError;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _currentError = null;
      _generalError = null;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    final NavigatorState navigator = Navigator.of(context);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<AuthProvider>().changePassword(_current.text, _new.text);
      navigator.pop();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Contraseña actualizada correctamente.')));
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        if (error.code == 'INVALID_CREDENTIALS') {
          _currentError = 'La contraseña actual es incorrecta.';
        } else {
          _generalError = error.fieldMessage('newPassword') ?? error.message;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cambiar contraseña'),
      content: SizedBox(
        width: 380,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              TextFormField(
                controller: _current,
                obscureText: true,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Contraseña actual',
                  errorText: _currentError,
                ),
                validator: (String? v) => Validators.required(v, 'la contraseña actual'),
              ),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                controller: _new,
                obscureText: true,
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
                validator: (String? v) =>
                    v == _new.text ? null : 'Las contraseñas no coinciden.',
                onFieldSubmitted: (_) => _submit(),
              ),
              if (_generalError != null) ...<Widget>[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  _generalError!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.danger),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: <Widget>[
        OutlinedButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _saving ? null : _submit,
          child: _saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onPrimary),
                )
              : const Text('Guardar'),
        ),
      ],
    );
  }
}
