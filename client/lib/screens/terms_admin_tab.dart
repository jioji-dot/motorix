import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/terms_admin_provider.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';

/// Términos y condiciones: versión vigente, quién aceptó y publicación de una versión nueva (Sprint 7, solo administrador).
class TermsAdminTab extends StatefulWidget {
  const TermsAdminTab({super.key});

  @override
  State<TermsAdminTab> createState() => _TermsAdminTabState();
}

class _TermsAdminTabState extends State<TermsAdminTab> {
  final _terminos = TextEditingController();
  final _privacidad = TextEditingController();
  String? _error;
  bool _publicando = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_terminos, _privacidad]) {
      c.addListener(() => setState(() {}));
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<TermsAdminProvider>().load();
    });
  }

  @override
  void dispose() {
    _terminos.dispose();
    _privacidad.dispose();
    super.dispose();
  }

  bool get _puedePublicar =>
      _terminos.text.trim().isNotEmpty &&
      _privacidad.text.trim().isNotEmpty &&
      !_publicando;

  Future<void> _publicar() async {
    final ok = await showConfirmDialog(
      context,
      title: 'Publicar versión nueva',
      message: 'Todos los usuarios tendrán que aceptar la versión nueva en su siguiente petición. ¿Publicarla?',
      confirmLabel: 'Publicar',
    );
    if (!ok || !mounted) return;
    setState(() {
      _publicando = true;
      _error = null;
    });
    final mensaje = await context.read<TermsAdminProvider>().publish(
      termsText: _terminos.text.trim(),
      privacyText: _privacidad.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _publicando = false;
      _error = mensaje;
      if (mensaje == null) {
        _terminos.clear();
        _privacidad.clear();
      }
    });
    if (mensaje == null) showFeedback(context, 'Versión publicada.');
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TermsAdminProvider>();
    if (provider.loading &&
        provider.current == null &&
        provider.acceptances == null) {
      return const LoadingState(message: 'Cargando los términos...');
    }
    if (provider.error != null) {
      return ErrorState(message: provider.error!, onRetry: provider.load);
    }
    final texto = Theme.of(context).textTheme;
    final vigente = provider.current;
    final aceptaciones = provider.acceptances;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            vigente == null
                ? 'Todavía no hay términos publicados'
                : 'Versión vigente: ${vigente.version}',
            style: texto.titleMedium,
          ),
          if (vigente != null) ...[
            Text(
              'Publicada el ${formatDate(vigente.publishedAt)}',
              style: texto.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            Container(
              constraints: const BoxConstraints(maxHeight: 180),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.outline),
                borderRadius: BorderRadius.circular(AppRadius.panel),
              ),
              child: SingleChildScrollView(
                child: Text(
                  '${vigente.termsText}\n\n${vigente.privacyText}',
                  style: texto.bodySmall,
                ),
              ),
            ),
          ],
          if (aceptaciones != null && aceptaciones.version != null) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Aceptaron (${aceptaciones.accepted.length})',
              style: texto.titleSmall,
            ),
            for (final a in aceptaciones.accepted)
              Text(
                '${a.name} · ${formatDate(a.acceptedAt)}',
                style: texto.bodySmall,
              ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Faltan por aceptar (${aceptaciones.pending.length})',
              style: texto.titleSmall,
            ),
            for (final a in aceptaciones.pending)
              Text(a.name, style: texto.bodySmall),
          ],
          const SizedBox(height: AppSpacing.xl),
          Text('Publicar versión nueva', style: texto.titleMedium),
          const SizedBox(height: AppSpacing.md),
          TextField(
            key: const Key('campo-terminos'),
            controller: _terminos,
            minLines: 4,
            maxLines: 8,
            maxLength: 20000,
            decoration: const InputDecoration(
              labelText: 'Términos y condiciones',
            ),
          ),
          TextField(
            key: const Key('campo-privacidad'),
            controller: _privacidad,
            minLines: 3,
            maxLines: 6,
            maxLength: 20000,
            decoration: const InputDecoration(labelText: 'Aviso de privacidad'),
          ),
          if (_error != null)
            Text(
              _error!,
              key: const Key('error-terminos'),
              style: texto.bodyMedium?.copyWith(color: AppColors.danger),
            ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            key: const Key('publicar-terminos'),
            onPressed: _puedePublicar ? _publicar : null,
            child: const Text('Publicar versión nueva'),
          ),
        ],
      ),
    );
  }
}
