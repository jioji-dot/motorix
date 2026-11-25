import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/button_spinner.dart';
import '../widgets/state_views.dart';

/// Pantalla de aceptación de los términos y condiciones y del aviso de privacidad (Sprint 7, FR-019).
/// No tiene otra salida que aceptar o rechazar (rechazar cierra la sesión).
class TermsScreen extends StatefulWidget {
  const TermsScreen({super.key});

  @override
  State<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends State<TermsScreen> {
  bool _guardando = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (auth.terms == null) auth.loadTerms();
    });
  }

  Future<void> _aceptar() async {
    setState(() {
      _guardando = true;
      _error = null;
    });
    final mensaje = await context.read<AuthProvider>().acceptTerms();
    if (mounted) {
      setState(() {
        _guardando = false;
        _error = mensaje;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final terms = auth.terms;
    final texto = Theme.of(context).textTheme;
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760, maxHeight: 720),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Términos y condiciones y aviso de privacidad',
                  style: texto.headlineSmall,
                ),
                if (terms != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Versión ${terms.version}${terms.publishedAt == null ? '' : ' · ${formatDate(terms.publishedAt)}'}',
                    style: texto.bodySmall,
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Expanded(
                  child: terms == null
                      ? (auth.termsError != null
                            ? ErrorState(
                                message: auth.termsError!,
                                onRetry: auth.loadTerms,
                              )
                            : const LoadingState(
                                message: 'Cargando los términos...',
                              ))
                      : Container(
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            border: Border.all(color: AppColors.outline),
                            borderRadius: BorderRadius.circular(
                              AppRadius.panel,
                            ),
                          ),
                          child: Scrollbar(
                            child: SingleChildScrollView(
                              key: const Key('texto-de-terminos'),
                              padding: const EdgeInsets.all(AppSpacing.lg),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    terms.termsText,
                                    style: texto.bodyMedium,
                                  ),
                                  const SizedBox(height: AppSpacing.xl),
                                  Text(
                                    terms.privacyText,
                                    style: texto.bodyMedium,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    _error!,
                    style: texto.bodyMedium?.copyWith(color: AppColors.danger),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      key: const Key('rechazar-terminos'),
                      onPressed: _guardando
                          ? null
                          : () => context.read<AuthProvider>().rejectTerms(),
                      child: const Text('Rechazar y salir'),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    FilledButton(
                      key: const Key('aceptar-terminos'),
                      onPressed: (terms == null || _guardando)
                          ? null
                          : _aceptar,
                      child: _guardando
                          ? const ButtonSpinner()
                          : const Text('Aceptar y continuar'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
