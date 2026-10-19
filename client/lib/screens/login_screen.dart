import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../widgets/button_spinner.dart';

/// Inicio de sesión con un único campo de usuario o correo (aplica a todos los roles).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = null);
    try {
      await context.read<AuthProvider>().login(_identifier.text, _password.text);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final texto = Theme.of(context).textTheme;
    final aviso = _error ?? auth.message;

    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Motorix', style: texto.headlineMedium?.copyWith(color: AppColors.primary)),
                      const SizedBox(height: AppSpacing.xs),
                      Text('Sistema de gestión para taller mecánico', style: texto.bodySmall),
                      const SizedBox(height: AppSpacing.xl),
                      TextFormField(
                        key: const Key('campo-identificador'),
                        controller: _identifier,
                        enabled: !auth.loading,
                        autofocus: true,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Usuario o correo',
                          prefixIcon: Icon(LucideIcons.user, size: 18),
                        ),
                        validator: (valor) =>
                            (valor == null || valor.trim().isEmpty) ? 'Ingresa tu usuario o correo.' : null,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        key: const Key('campo-contrasena'),
                        controller: _password,
                        enabled: !auth.loading,
                        obscureText: _obscure,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Contraseña',
                          prefixIcon: const Icon(LucideIcons.lock, size: 18),
                          suffixIcon: IconButton(
                            tooltip: _obscure ? 'Mostrar contraseña' : 'Ocultar contraseña',
                            onPressed: () => setState(() => _obscure = !_obscure),
                            icon: Icon(_obscure ? LucideIcons.eye : LucideIcons.eyeOff, size: 18),
                          ),
                        ),
                        validator: (valor) =>
                            (valor == null || valor.isEmpty) ? 'Ingresa tu contraseña.' : null,
                      ),
                      AnimatedSize(
                        duration: AppMotion.appear,
                        curve: AppMotion.curve,
                        child: aviso == null
                            ? const SizedBox(width: double.infinity)
                            : Padding(
                                padding: const EdgeInsets.only(top: AppSpacing.lg),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(LucideIcons.circleAlert, size: 16, color: AppColors.danger),
                                    const SizedBox(width: AppSpacing.sm),
                                    Expanded(
                                      child: Text(
                                        aviso,
                                        style: texto.bodyMedium?.copyWith(color: AppColors.danger),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      FilledButton(
                        onPressed: auth.loading ? null : _submit,
                        child: auth.loading
                            ? const ButtonSpinner()
                            : const Text('Iniciar sesión'),
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
