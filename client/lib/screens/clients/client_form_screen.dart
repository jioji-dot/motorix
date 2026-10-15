import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/client.dart';
import '../../providers/clients_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/validators.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';

/// Formulario de cliente: alta (sin [client]) o edición (con [client]).
class ClientFormScreen extends StatefulWidget {
  const ClientFormScreen({super.key, this.client});

  final Client? client;

  @override
  State<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends State<ClientFormScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _address;

  bool _saving = false;
  bool _allowPop = false;
  Map<String, String> _serverErrors = <String, String>{};

  bool get _isEdit => widget.client != null;

  @override
  void initState() {
    super.initState();
    final Client? c = widget.client;
    _name = TextEditingController(text: c?.name ?? '');
    _phone = TextEditingController(text: c?.phone ?? '');
    _email = TextEditingController(text: c?.email ?? '');
    _address = TextEditingController(text: c?.address ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _address.dispose();
    super.dispose();
  }

  bool get _dirty {
    final Client? c = widget.client;
    return _name.text != (c?.name ?? '') ||
        _phone.text != (c?.phone ?? '') ||
        _email.text != (c?.email ?? '') ||
        _address.text != (c?.address ?? '');
  }

  String? _nullIfEmpty(String texto) => texto.trim().isEmpty ? null : texto.trim();

  Future<void> _save({bool confirmedDuplicate = false}) async {
    setState(() => _serverErrors = <String, String>{});
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _saving = true);
    final ClientsProvider provider = context.read<ClientsProvider>();
    final ClientInput input = ClientInput(
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      email: _nullIfEmpty(_email.text),
      address: _nullIfEmpty(_address.text),
    );

    try {
      if (_isEdit) {
        await provider.update(widget.client!.id, input, confirmDuplicatePhone: confirmedDuplicate);
      } else {
        await provider.create(input, confirmDuplicatePhone: confirmedDuplicate);
      }
      if (!mounted) return;
      showAppSnackBar(
        context,
        _isEdit ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.',
      );
      setState(() => _allowPop = true);
      Navigator.of(context).pop(true);
    } on ApiError catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      await _handleError(error);
    }
  }

  Future<void> _handleError(ApiError error) async {
    if (error.code == 'PHONE_DUPLICATE_WARNING') {
      final dynamic coincidencias = error.detail('matches');
      final String nombres = coincidencias is List
          ? coincidencias.map((dynamic m) => (m as Map<String, dynamic>)['name']).join(', ')
          : 'otro cliente';
      final bool confirmar = await showConfirmDialog(
        context,
        title: 'Teléfono repetido',
        message: 'Ya existe un cliente con ese teléfono ($nombres). '
            '¿Quieres guardar este cliente de todas formas?',
      );
      if (confirmar && mounted) await _save(confirmedDuplicate: true);
      return;
    }

    if (error.code == 'VALIDATION_ERROR' && error.details is List) {
      final Map<String, String> campos = <String, String>{};
      for (final dynamic d in error.details as List<dynamic>) {
        if (d is Map && d['field'] != null) {
          campos[d['field'] as String] = d['message'] as String;
        }
      }
      setState(() => _serverErrors = campos);
      return;
    }

    showAppSnackBar(context, error.message, isError: true);
  }

  Future<void> _cancel() async {
    await Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
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
        currentRoute: AppRoutes.clients,
        title: _isEdit ? 'Editar cliente' : 'Nuevo cliente',
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
                        controller: _name,
                        enabled: !_saving,
                        decoration: InputDecoration(
                          labelText: 'Nombre *',
                          errorText: _serverErrors['name'],
                        ),
                        validator: (String? v) =>
                            Validators.required(v, 'el nombre') ?? Validators.maxLength(v, 120),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _phone,
                        enabled: !_saving,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: 'Teléfono *',
                          errorText: _serverErrors['phone'],
                        ),
                        validator: Validators.phone,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _email,
                        enabled: !_saving,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                          labelText: 'Correo electrónico',
                          errorText: _serverErrors['email'],
                        ),
                        validator: Validators.email,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      TextFormField(
                        controller: _address,
                        enabled: !_saving,
                        decoration: InputDecoration(
                          labelText: 'Dirección',
                          errorText: _serverErrors['address'],
                        ),
                        validator: (String? v) => Validators.maxLength(v, 255),
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: <Widget>[
                          OutlinedButton(
                            onPressed: _saving ? null : _cancel,
                            child: const Text('Cancelar'),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          FilledButton(
                            onPressed: _saving ? null : () => _save(),
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
