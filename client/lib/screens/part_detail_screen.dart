import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/part.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/parts_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'part_form_screen.dart';

/// Detalle de una refacción con su historial de movimientos. El administrador edita, desactiva y registra movimientos.
class PartDetailScreen extends StatefulWidget {
  const PartDetailScreen({super.key, required this.partId});

  final int partId;

  @override
  State<PartDetailScreen> createState() => _PartDetailScreenState();
}

class _PartDetailScreenState extends State<PartDetailScreen> {
  PartDetail? _detail;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detalle = await context.read<PartsProvider>().fetchDetail(widget.partId);
      if (mounted) setState(() => _detail = detalle);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final guardado = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PartFormScreen(part: _detail!.part)),
    );
    if (guardado == true) await _load();
  }

  Future<void> _toggleActive() async {
    final parte = _detail!.part;
    if (parte.active) {
      final confirmado = await showConfirmDialog(
        context,
        title: 'Desactivar refacción',
        message:
            '"${parte.name}" dejará de ofrecerse para nuevas órdenes. Su historial se conserva y podrás reactivarla cuando quieras.',
        confirmLabel: 'Desactivar',
        destructive: true,
      );
      if (!confirmado || !mounted) return;
    }
    try {
      await context.read<PartsProvider>().update(parte.id, {'active': !parte.active});
      if (!mounted) return;
      showFeedback(context, parte.active ? 'Refacción desactivada.' : 'Refacción reactivada.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
    }
  }

  Future<void> _registerMovement() async {
    final parte = _detail!.part;
    final datos = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _MovementDialog(currentStock: parte.stock),
    );
    if (datos == null || !mounted) return;
    try {
      await context.read<PartsProvider>().registerMovement(
            parte.id,
            type: datos['type'] as String,
            quantity: datos['quantity'] as int,
            reason: datos['reason'] as String,
          );
      if (!mounted) return;
      showFeedback(context, 'Movimiento registrado.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_detail?.part.name ?? 'Detalle de la refacción'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _detail == null) return const LoadingState();
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final detalle = _detail!;
    final parte = detalle.part;
    final esAdmin = context.select<AuthProvider, bool>((a) => a.role == UserRole.admin);
    final texto = Theme.of(context).textTheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(parte.name, style: texto.titleLarge)),
                          StatusChip.stock(parte.stockLevel),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _Dato(etiqueta: 'Código', valor: parte.code),
                      _Dato(etiqueta: 'Categoría', valor: parte.category),
                      _Dato(etiqueta: 'Marca', valor: parte.brand),
                      _Dato(etiqueta: 'Stock actual', valor: '${parte.stock}'),
                      _Dato(etiqueta: 'Stock mínimo', valor: '${parte.minimumStock}'),
                      _Dato(etiqueta: 'Precio de venta', valor: formatMoney(parte.salePrice)),
                      if (parte.purchasePrice != null)
                        _Dato(etiqueta: 'Precio de compra', valor: formatMoney(parte.purchasePrice)),
                      if (esAdmin) ...[
                        const SizedBox(height: AppSpacing.lg),
                        Wrap(
                          spacing: AppSpacing.md,
                          runSpacing: AppSpacing.md,
                          children: [
                            FilledButton(
                              key: const Key('boton-registrar-movimiento'),
                              onPressed: _registerMovement,
                              child: const Text('Registrar movimiento'),
                            ),
                            OutlinedButton(onPressed: _edit, child: const Text('Editar')),
                            OutlinedButton(
                              onPressed: _toggleActive,
                              child: Text(parte.active ? 'Desactivar' : 'Reactivar'),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Movimientos de inventario', style: texto.titleMedium),
                      const SizedBox(height: AppSpacing.md),
                      if (detalle.movements.isEmpty)
                        Text('Sin movimientos registrados', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
                      else
                        for (final m in detalle.movements) _FilaDeMovimiento(movimiento: m),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          SizedBox(width: 140, child: Text(etiqueta, style: texto.bodySmall)),
          Expanded(child: Text(valor, style: texto.bodyLarge)),
        ],
      ),
    );
  }
}

String _etiquetaDeMovimiento(String tipo) => switch (tipo) {
      'IN' => 'Entrada',
      'OUT' => 'Salida',
      _ => 'Ajuste',
    };

class _FilaDeMovimiento extends StatelessWidget {
  const _FilaDeMovimiento({required this.movimiento});

  final InventoryMovement movimiento;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final positivo = movimiento.quantity > 0;
    final cantidad = positivo ? '+${movimiento.quantity}' : '${movimiento.quantity}';
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 130, child: Text(formatDateTime(movimiento.createdAt), style: texto.bodySmall)),
          SizedBox(width: 70, child: Text(_etiquetaDeMovimiento(movimiento.type), style: texto.bodyMedium)),
          SizedBox(
            width: 60,
            child: Text(
              cantidad,
              style: texto.titleSmall?.copyWith(color: positivo ? AppColors.success : AppColors.danger),
            ),
          ),
          Expanded(
            child: Text(
              '${movimiento.reason} · ${movimiento.createdByName}',
              style: texto.bodyMedium,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Text('Stock: ${movimiento.stockAfter}', style: texto.bodySmall),
        ],
      ),
    );
  }
}

/// Diálogo para registrar una entrada, una salida o un ajuste. Muestra el stock resultante antes de confirmar.
class _MovementDialog extends StatefulWidget {
  const _MovementDialog({required this.currentStock});

  final int currentStock;

  @override
  State<_MovementDialog> createState() => _MovementDialogState();
}

class _MovementDialogState extends State<_MovementDialog> {
  final _formKey = GlobalKey<FormState>();
  final _quantity = TextEditingController();
  final _reason = TextEditingController();
  String _type = 'IN';

  @override
  void dispose() {
    _quantity.dispose();
    _reason.dispose();
    super.dispose();
  }

  int? get _cantidad => int.tryParse(_quantity.text.trim());

  /// Cambio de stock con signo según el tipo; nulo mientras la cantidad no sea válida.
  int? get _cambio {
    final cantidad = _cantidad;
    if (cantidad == null) return null;
    return _type == 'OUT' ? -cantidad : cantidad;
  }

  String? _validarCantidad(String? valor) {
    final cantidad = int.tryParse((valor ?? '').trim());
    if (cantidad == null) return 'La cantidad debe ser un número entero.';
    if (_type == 'ADJUSTMENT') {
      if (cantidad == 0) return 'El ajuste debe ser una diferencia distinta de cero.';
      if (cantidad.abs() > 1000000) return 'El ajuste no puede ser mayor a 1,000,000 piezas.';
    } else if (cantidad < 1 || cantidad > 1000000) {
      return 'La cantidad debe ser un número entero entre 1 y 1,000,000.';
    }
    final resultado = widget.currentStock + (_type == 'OUT' ? -cantidad : cantidad);
    if (resultado < 0) return 'El stock no puede quedar negativo (disponible: ${widget.currentStock}).';
    return null;
  }

  void _guardar() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.of(context).pop(<String, dynamic>{
      'type': _type,
      'quantity': _cantidad,
      'reason': _reason.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final cambio = _cambio;
    final resultado = cambio == null ? null : widget.currentStock + cambio;
    return AlertDialog(
      title: const Text('Registrar movimiento'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          onChanged: () => setState(() {}),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  key: const Key('campo-tipo-movimiento'),
                  initialValue: _type,
                  decoration: const InputDecoration(labelText: 'Tipo de movimiento'),
                  items: const [
                    DropdownMenuItem(value: 'IN', child: Text('Entrada')),
                    DropdownMenuItem(value: 'OUT', child: Text('Salida')),
                    DropdownMenuItem(value: 'ADJUSTMENT', child: Text('Ajuste (diferencia)')),
                  ],
                  onChanged: (valor) => setState(() => _type = valor ?? 'IN'),
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  key: const Key('campo-cantidad'),
                  controller: _quantity,
                  keyboardType: const TextInputType.numberWithOptions(signed: true),
                  decoration: InputDecoration(
                    labelText: _type == 'ADJUSTMENT' ? 'Diferencia (puede ser negativa)' : 'Cantidad',
                  ),
                  validator: _validarCantidad,
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  key: const Key('campo-motivo'),
                  controller: _reason,
                  maxLength: 255,
                  decoration: const InputDecoration(labelText: 'Motivo', counterText: ''),
                  validator: (v) {
                    final t = (v ?? '').trim();
                    if (t.isEmpty) return 'El motivo es obligatorio.';
                    if (t.length > 255) return 'El motivo no puede tener más de 255 caracteres.';
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  key: const Key('stock-resultante'),
                  resultado == null
                      ? 'Stock actual: ${widget.currentStock}'
                      : 'Stock actual: ${widget.currentStock} → resultante: $resultado',
                  style: texto.bodyMedium?.copyWith(
                    color: (resultado ?? 0) < 0 ? AppColors.danger : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _guardar, child: const Text('Registrar')),
      ],
    );
  }
}
