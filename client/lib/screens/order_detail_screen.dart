import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../models/service_order.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../providers/orders_provider.dart';
import '../services/api_client.dart';
import '../utils/app_theme.dart';
import '../utils/format.dart';
import '../widgets/button_spinner.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/order_line_dialogs.dart';
import '../widgets/part_picker_dialog.dart';
import '../widgets/payment_section.dart';
import '../widgets/state_views.dart';
import '../widgets/status_chip.dart';
import 'maintenance_form_screen.dart';

/// Detalle de una orden de servicio: datos, trabajo documentado, líneas, total e historial.
/// El mecánico asignado (o el administrador) documenta el trabajo mientras la orden está en curso.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  ServiceOrder? _order;
  bool _loading = true;
  String? _error;
  bool _editingWork = false;
  bool _saving = false;
  final _diagnosis = TextEditingController();
  final _notes = TextEditingController();
  final _recommendations = TextEditingController();
  final _serviceMileage = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _diagnosis.dispose();
    _notes.dispose();
    _recommendations.dispose();
    _serviceMileage.dispose();
    super.dispose();
  }

  User get _user => context.read<AuthProvider>().user!;

  /// Documentar el trabajo: mecánico asignado o administrador, y solo con la orden en curso.
  bool get _canDocument {
    final orden = _order;
    if (orden == null || !orden.isOpen) return false;
    final user = _user;
    return user.role == UserRole.admin || (user.role == UserRole.mechanic && user.id == orden.mechanicId);
  }

  /// Datos de la orden (problema reportado y mecánico): recepción y administración, mientras no esté cerrada.
  bool get _canEditData {
    final orden = _order;
    if (orden == null || orden.isFinal) return false;
    final rol = _user.role;
    return rol == UserRole.admin || rol == UserRole.receptionist;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final orden = await context.read<OrdersProvider>().fetchDetail(widget.orderId);
      if (mounted) setState(() => _order = orden);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Ejecuta un cambio sobre la orden, actualiza la pantalla con la respuesta y avisa del resultado.
  Future<bool> _ejecutar(Future<ServiceOrder> Function(OrdersProvider) accion, String exito) async {
    try {
      final orden = await accion(context.read<OrdersProvider>());
      if (!mounted) return false;
      setState(() => _order = orden);
      showFeedback(context, exito);
      return true;
    } on ApiException catch (e) {
      if (mounted) showFeedback(context, e.message, error: true);
      return false;
    }
  }

  // ---- Trabajo documentado

  void _empezarEdicion() {
    final orden = _order!;
    _diagnosis.text = orden.diagnosis ?? '';
    _notes.text = orden.notes ?? '';
    _recommendations.text = orden.recommendations ?? '';
    _serviceMileage.text = orden.serviceMileage?.toString() ?? '';
    setState(() => _editingWork = true);
  }

  bool get _hayCambiosDeTrabajo {
    final orden = _order!;
    return _diagnosis.text != (orden.diagnosis ?? '') ||
        _notes.text != (orden.notes ?? '') ||
        _recommendations.text != (orden.recommendations ?? '') ||
        _serviceMileage.text.trim() != (orden.serviceMileage?.toString() ?? '');
  }

  /// Error del kilometraje del servicio (opcional): entero entre el de entrada y 1,500,000.
  String? get _errorKilometrajeServicio => validarKilometrajeDelServicio(_serviceMileage.text, _order!.entryMileage);

  Future<void> _cancelarEdicion() async {
    if (_hayCambiosDeTrabajo && !await confirmDiscardChanges(context)) return;
    if (mounted) setState(() => _editingWork = false);
  }

  Future<void> _guardarTrabajo() async {
    setState(() => _saving = true);
    final guardado = await _ejecutar(
      (p) => p.update(widget.orderId, {
        'diagnosis': _diagnosis.text.trim(),
        'notes': _notes.text.trim(),
        'recommendations': _recommendations.text.trim(),
        if (_serviceMileage.text.trim().isNotEmpty &&
            _serviceMileage.text.trim() != (_order!.serviceMileage?.toString() ?? ''))
          'serviceMileage': int.parse(_serviceMileage.text.trim()),
      }),
      'Trabajo documentado guardado.',
    );
    if (mounted) {
      setState(() {
        _saving = false;
        if (guardado) _editingWork = false;
      });
    }
  }

  // ---- Líneas

  Future<void> _agregarServicio() async {
    final datos = await showServiceDialog(context);
    if (datos == null || !mounted) return;
    await _ejecutar((p) => p.addService(widget.orderId, datos), 'Servicio agregado.');
  }

  Future<void> _editarServicio(OrderService servicio) async {
    final datos = await showServiceDialog(context, service: servicio);
    if (datos == null || !mounted) return;
    await _ejecutar((p) => p.updateService(widget.orderId, servicio.id, datos), 'Servicio actualizado.');
  }

  Future<void> _quitarServicio(OrderService servicio) async {
    final confirmado = await showConfirmDialog(
      context,
      title: 'Quitar servicio',
      message: '¿Quitar "${servicio.description}" de la orden? El total se recalculará.',
      destructive: true,
    );
    if (!confirmado || !mounted) return;
    await _ejecutar((p) => p.removeService(widget.orderId, servicio.id), 'Servicio quitado.');
  }

  Future<void> _agregarManoDeObra() async {
    final datos = await showLaborDialog(context);
    if (datos == null || !mounted) return;
    await _ejecutar((p) => p.addLabor(widget.orderId, datos), 'Mano de obra agregada.');
  }

  Future<void> _editarManoDeObra(OrderLabor mano) async {
    final datos = await showLaborDialog(context, labor: mano);
    if (datos == null || !mounted) return;
    await _ejecutar((p) => p.updateLabor(widget.orderId, mano.id, datos), 'Mano de obra actualizada.');
  }

  Future<void> _quitarManoDeObra(OrderLabor mano) async {
    final confirmado = await showConfirmDialog(
      context,
      title: 'Quitar mano de obra',
      message: '¿Quitar "${mano.description}" de la orden? El total se recalculará.',
      destructive: true,
    );
    if (!confirmado || !mounted) return;
    await _ejecutar((p) => p.removeLabor(widget.orderId, mano.id), 'Mano de obra quitada.');
  }

  // ---- Refacciones

  Future<void> _agregarRefaccion() async {
    final seleccion = await showPartPicker(context);
    if (seleccion == null || !mounted) return;
    await _ejecutar((p) => p.addPart(widget.orderId, seleccion.part.id, seleccion.quantity), 'Refacción agregada.');
  }

  Future<void> _editarRefaccion(OrderPart linea) async {
    final cantidad = await showQuantityDialog(context, title: 'Cambiar cantidad', label: linea.name, initial: linea.quantity);
    if (cantidad == null || cantidad == linea.quantity || !mounted) return;
    await _ejecutar((p) => p.updatePart(widget.orderId, linea.id, cantidad), 'Cantidad actualizada.');
  }

  Future<void> _quitarRefaccion(OrderPart linea) async {
    final confirmado = await showConfirmDialog(
      context,
      title: 'Quitar refacción',
      message: '¿Quitar "${linea.name}" de la orden? Las piezas regresarán al inventario y el total se recalculará.',
      destructive: true,
    );
    if (!confirmado || !mounted) return;
    await _ejecutar((p) => p.removePart(widget.orderId, linea.id), 'Refacción quitada.');
  }

  // ---- Próximo mantenimiento

  /// Los pagos y el ticket son de recepción y administración, con la orden Terminada o Entregada.
  bool get _canCollect {
    final orden = _order;
    if (orden == null || !orden.isCompleted) return false;
    final rol = _user.role;
    return rol == UserRole.admin || rol == UserRole.receptionist;
  }

  bool get _canScheduleMaintenance {
    final orden = _order;
    if (orden == null || !orden.isCompleted) return false;
    final rol = _user.role;
    return rol == UserRole.admin || rol == UserRole.mechanic;
  }

  Future<void> _programarMantenimiento() async {
    final orden = _order!;
    // La fecha del servicio es la del cambio a Terminado; si no consta, la de hoy.
    final terminado = orden.history.where((h) => h.toStatus == 'TERMINADO');
    final fecha = terminado.isEmpty ? DateTime.now() : terminado.last.changedAt;
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => MaintenanceFormScreen(
          preset: MaintenancePreset(
            vehicleId: orden.vehicleId,
            vehicleLabel: '${orden.vehicleTitle} · ${orden.licensePlate}',
            lastServiceDate: fecha,
            lastMileage: orden.serviceMileage ?? orden.entryMileage,
            sourceOrderId: orden.id,
          ),
        ),
      ),
    );
  }

  // ---- Cambio de estado

  Future<String?> _pedirMotivoDeCancelacion() => showDialog<String>(
        context: context,
        builder: (_) => const _MotivoCancelacionDialog(),
      );

  Future<void> _cambiarEstado(String destino) async {
    final orden = _order!;
    String? motivo;

    if (destino == 'ENTREGADO') {
      final confirmado = await showConfirmDialog(
        context,
        title: 'Entregar vehículo',
        message: 'La orden quedará Entregada y ya no podrá modificarse. ¿Confirmas la entrega?',
      );
      if (!confirmado || !mounted) return;
    } else if (destino == 'CANCELADA') {
      motivo = await _pedirMotivoDeCancelacion();
      if (motivo == null || !mounted) return;
    }

    try {
      final actualizada = await context
          .read<OrdersProvider>()
          .changeStatus(widget.orderId, destino, reason: motivo, expectedStatus: orden.status);
      if (!mounted) return;
      setState(() => _order = actualizada);
      showFeedback(context, 'Estado actualizado: ${orderStatusLabel(destino)}.');
    } on ApiException catch (e) {
      if (!mounted) return;
      showFeedback(context, e.message, error: true);
      // Si alguien más cambió la orden, se vuelve a cargar para mostrar su estado real.
      if (e.code == 'STATE_CONFLICT') await _load();
    }
  }

  // ---- Datos de la orden

  Future<void> _editarDatos() async {
    final orden = _order!;
    final datos = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _EditarDatosDialog(orden: orden, provider: context.read<OrdersProvider>()),
    );
    if (datos == null || datos.isEmpty || !mounted) return;
    await _ejecutar((p) => p.update(widget.orderId, datos), 'Datos de la orden actualizados.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_order?.folio ?? 'Orden de servicio'),
        backgroundColor: AppColors.surface,
        scrolledUnderElevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _order == null) return const LoadingState();
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    final orden = _order!;
    final puedeDocumentar = _canDocument;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DatosGenerales(orden: orden, onEdit: _canEditData ? _editarDatos : null),
              if (orden.allowedTransitions.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                _AccionesDeEstado(orden: orden, onChange: _cambiarEstado),
              ],
              const SizedBox(height: AppSpacing.lg),
              _editingWork
                  ? _EdicionDeTrabajo(
                      diagnosis: _diagnosis,
                      notes: _notes,
                      recommendations: _recommendations,
                      serviceMileage: _serviceMileage,
                      mileageError: _errorKilometrajeServicio,
                      entryMileage: orden.entryMileage,
                      saving: _saving,
                      onChanged: () => setState(() {}),
                      onSave: _guardarTrabajo,
                      onCancel: _cancelarEdicion,
                    )
                  : _TrabajoDocumentado(orden: orden, onEdit: puedeDocumentar ? _empezarEdicion : null),
              const SizedBox(height: AppSpacing.lg),
              _Lineas(
                orden: orden,
                editable: puedeDocumentar,
                onAddService: _agregarServicio,
                onEditService: _editarServicio,
                onRemoveService: _quitarServicio,
                onAddLabor: _agregarManoDeObra,
                onEditLabor: _editarManoDeObra,
                onRemoveLabor: _quitarManoDeObra,
                onAddPart: _agregarRefaccion,
                onEditPart: _editarRefaccion,
                onRemovePart: _quitarRefaccion,
              ),
              if (_canCollect) ...[
                const SizedBox(height: AppSpacing.lg),
                PaymentSection(orderId: widget.orderId),
              ],
              if (_canScheduleMaintenance) ...[
                const SizedBox(height: AppSpacing.lg),
                _ProgramarMantenimiento(onPressed: _programarMantenimiento),
              ],
              const SizedBox(height: AppSpacing.lg),
              _Historial(orden: orden),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarjeta con título de sección.
class _Seccion extends StatelessWidget {
  const _Seccion({required this.titulo, required this.child});

  final String titulo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titulo, style: texto.titleMedium),
            const SizedBox(height: AppSpacing.md),
            child,
          ],
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 160, child: Text(etiqueta, style: texto.bodySmall)),
          Expanded(child: Text(valor, style: texto.bodyLarge)),
        ],
      ),
    );
  }
}

class _DatosGenerales extends StatelessWidget {
  const _DatosGenerales({required this.orden, this.onEdit});

  final ServiceOrder orden;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(orden.folio, style: texto.titleLarge)),
                StatusChip.order(orden.status),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            _Dato(etiqueta: 'Cliente', valor: orden.clientName),
            _Dato(etiqueta: 'Vehículo', valor: '${orden.vehicleTitle} · ${orden.licensePlate}'),
            _Dato(etiqueta: 'Mecánico asignado', valor: orden.mechanicName),
            _Dato(etiqueta: 'Kilometraje de entrada', valor: formatMileage(orden.entryMileage)),
            _Dato(etiqueta: 'Fecha de creación', valor: formatDateTime(orden.createdAt)),
            _Dato(etiqueta: 'Problema reportado', valor: orden.reportedProblem),
            if (orden.status == 'CANCELADA')
              _Dato(etiqueta: 'Motivo de cancelación', valor: orden.cancellationReason ?? '—'),
            if (orden.deliveredAt != null) _Dato(etiqueta: 'Fecha de entrega', valor: formatDateTime(orden.deliveredAt)),
            if (onEdit != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(onPressed: onEdit, child: const Text('Editar datos de la orden')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TrabajoDocumentado extends StatelessWidget {
  const _TrabajoDocumentado({required this.orden, this.onEdit});

  final ServiceOrder orden;
  final VoidCallback? onEdit;

  Widget _bloque(BuildContext context, String titulo, String? valor, String vacio) {
    final texto = Theme.of(context).textTheme;
    final hayTexto = (valor ?? '').trim().isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo, style: texto.bodySmall),
          const SizedBox(height: AppSpacing.xs),
          Text(
            hayTexto ? valor! : vacio,
            style: hayTexto ? texto.bodyLarge : texto.bodyLarge?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _Seccion(
      titulo: 'Trabajo documentado',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _bloque(context, 'Diagnóstico', orden.diagnosis, 'Sin diagnóstico registrado'),
          _bloque(context, 'Observaciones', orden.notes, 'Sin observaciones'),
          _bloque(context, 'Recomendaciones', orden.recommendations, 'Sin recomendaciones'),
          _bloque(
            context,
            'Kilometraje del servicio',
            orden.serviceMileage == null ? null : formatMileage(orden.serviceMileage!),
            'No registrado',
          ),
          if (onEdit != null) OutlinedButton(onPressed: onEdit, child: const Text('Editar trabajo')),
        ],
      ),
    );
  }
}

class _EdicionDeTrabajo extends StatelessWidget {
  const _EdicionDeTrabajo({
    required this.diagnosis,
    required this.notes,
    required this.recommendations,
    required this.serviceMileage,
    required this.mileageError,
    required this.entryMileage,
    required this.saving,
    required this.onChanged,
    required this.onSave,
    required this.onCancel,
  });

  final TextEditingController diagnosis;
  final TextEditingController notes;
  final TextEditingController recommendations;
  final TextEditingController serviceMileage;
  final String? mileageError;
  final int entryMileage;
  final bool saving;
  final VoidCallback onChanged;
  final VoidCallback onSave;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    Widget campo(String llave, String etiqueta, TextEditingController controlador) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.lg),
          child: TextField(
            key: Key(llave),
            controller: controlador,
            minLines: 2,
            maxLines: 6,
            maxLength: 4000,
            onChanged: (_) => onChanged(),
            decoration: InputDecoration(labelText: etiqueta, counterText: ''),
          ),
        );

    return _Seccion(
      titulo: 'Trabajo documentado',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          campo('campo-diagnostico', 'Diagnóstico', diagnosis),
          campo('campo-observaciones', 'Observaciones', notes),
          campo('campo-recomendaciones', 'Recomendaciones', recommendations),
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: TextField(
              key: const Key('campo-km-servicio'),
              controller: serviceMileage,
              keyboardType: TextInputType.number,
              onChanged: (_) => onChanged(),
              decoration: InputDecoration(
                labelText: 'Kilometraje del servicio (opcional)',
                helperText: 'Entrada: ${formatMileage(entryMileage)}',
                errorText: mileageError,
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              OutlinedButton(onPressed: saving ? null : onCancel, child: const Text('Cancelar')),
              const SizedBox(width: AppSpacing.md),
              FilledButton(
                onPressed: (saving || mileageError != null) ? null : onSave,
                child: saving ? const ButtonSpinner() : const Text('Guardar'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Lineas extends StatelessWidget {
  const _Lineas({
    required this.orden,
    required this.editable,
    required this.onAddService,
    required this.onEditService,
    required this.onRemoveService,
    required this.onAddLabor,
    required this.onEditLabor,
    required this.onRemoveLabor,
    required this.onAddPart,
    required this.onEditPart,
    required this.onRemovePart,
  });

  final ServiceOrder orden;
  final bool editable;
  final VoidCallback onAddService;
  final void Function(OrderService) onEditService;
  final void Function(OrderService) onRemoveService;
  final VoidCallback onAddLabor;
  final void Function(OrderLabor) onEditLabor;
  final void Function(OrderLabor) onRemoveLabor;
  final VoidCallback onAddPart;
  final void Function(OrderPart) onEditPart;
  final void Function(OrderPart) onRemovePart;

  Widget _acciones({required String editar, required String quitar, required VoidCallback onEdit, required VoidCallback onRemove}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(tooltip: editar, onPressed: onEdit, icon: const Icon(LucideIcons.pencil, size: 16)),
        IconButton(tooltip: quitar, onPressed: onRemove, icon: const Icon(LucideIcons.trash2, size: 16)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return _Seccion(
      titulo: 'Servicios, mano de obra y refacciones',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Servicios realizados', style: texto.titleSmall)),
              if (editable) OutlinedButton(onPressed: onAddService, child: const Text('Agregar servicio')),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (orden.services.isEmpty)
            Text('Sin servicios registrados', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
          else
            for (final s in orden.services)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(child: Text(s.description)),
                    Text(formatMoney(s.amount)),
                    if (editable)
                      _acciones(
                        editar: 'Editar servicio',
                        quitar: 'Quitar servicio',
                        onEdit: () => onEditService(s),
                        onRemove: () => onRemoveService(s),
                      ),
                  ],
                ),
              ),
          const Divider(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(child: Text('Mano de obra', style: texto.titleSmall)),
              if (editable) OutlinedButton(onPressed: onAddLabor, child: const Text('Agregar mano de obra')),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (orden.labor.isEmpty)
            Text('Sin mano de obra registrada', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
          else
            for (final l in orden.labor)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(child: Text(l.description)),
                    Text('${l.hours} h × ${formatMoney(l.hourlyRate)}', style: texto.bodySmall),
                    const SizedBox(width: AppSpacing.lg),
                    Text(formatMoney(l.amount)),
                    if (editable)
                      _acciones(
                        editar: 'Editar mano de obra',
                        quitar: 'Quitar mano de obra',
                        onEdit: () => onEditLabor(l),
                        onRemove: () => onRemoveLabor(l),
                      ),
                  ],
                ),
              ),
          const Divider(height: AppSpacing.xl),
          Row(
            children: [
              Expanded(child: Text('Refacciones utilizadas', style: texto.titleSmall)),
              if (editable)
                OutlinedButton(
                  key: const Key('boton-agregar-refaccion'),
                  onPressed: onAddPart,
                  child: const Text('Agregar refacción'),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (orden.parts.isEmpty)
            Text('Sin refacciones registradas', style: texto.bodyLarge?.copyWith(color: AppColors.textSecondary))
          else
            for (final r in orden.parts)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Expanded(child: Text(r.name, overflow: TextOverflow.ellipsis)),
                    Text('${r.quantity} × ${formatMoney(r.unitPrice)}', style: texto.bodySmall),
                    const SizedBox(width: AppSpacing.lg),
                    Text(formatMoney(r.amount)),
                    if (editable)
                      _acciones(
                        editar: 'Cambiar cantidad',
                        quitar: 'Quitar refacción',
                        onEdit: () => onEditPart(r),
                        onRemove: () => onRemovePart(r),
                      ),
                  ],
                ),
              ),
          const Divider(height: AppSpacing.xl),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('Total  ', style: texto.titleSmall),
              Text(formatMoney(orden.total), style: texto.titleMedium),
            ],
          ),
        ],
      ),
    );
  }
}

/// Acceso a programar el próximo mantenimiento desde una orden terminada o entregada.
class _ProgramarMantenimiento extends StatelessWidget {
  const _ProgramarMantenimiento({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return _Seccion(
      titulo: 'Próximo mantenimiento',
      child: Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton(
          key: const Key('boton-programar-mantenimiento'),
          onPressed: onPressed,
          child: const Text('Programar próximo mantenimiento'),
        ),
      ),
    );
  }
}

class _Historial extends StatelessWidget {
  const _Historial({required this.orden});

  final ServiceOrder orden;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return _Seccion(
      titulo: 'Historial de estados',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final h in orden.history)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 160, child: Text(formatDateTime(h.changedAt), style: texto.bodySmall)),
                  StatusChip.order(h.toStatus),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      h.reason == null || h.reason!.isEmpty ? h.changedBy : '${h.changedBy} · ${h.reason}',
                      style: texto.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Botones para las transiciones que el usuario actual puede aplicar (las calcula el servidor).
class _AccionesDeEstado extends StatelessWidget {
  const _AccionesDeEstado({required this.orden, required this.onChange});

  final ServiceOrder orden;
  final void Function(String destino) onChange;

  // Orden en que se presentan los botones y su texto (el texto de "En reparación" depende de dónde se viene).
  static const _orden = ['DIAGNOSTICO', 'EN_REPARACION', 'TERMINADO', 'ESPERANDO_REFACCION', 'ENTREGADO', 'CANCELADA'];

  String _etiqueta(String destino) {
    switch (destino) {
      case 'DIAGNOSTICO':
        return 'Iniciar diagnóstico';
      case 'EN_REPARACION':
        return orden.status == 'ESPERANDO_REFACCION' ? 'Reanudar reparación' : 'Iniciar reparación';
      case 'ESPERANDO_REFACCION':
        return 'Esperar refacción';
      case 'TERMINADO':
        return 'Marcar como terminada';
      case 'ENTREGADO':
        return 'Entregar vehículo';
      default:
        return 'Cancelar orden';
    }
  }

  @override
  Widget build(BuildContext context) {
    final destinos = [for (final d in _orden) if (orden.allowedTransitions.contains(d)) d];
    return Card(
      key: const Key('acciones-de-estado'),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            for (final destino in destinos)
              if (destino == 'ESPERANDO_REFACCION' || destino == 'CANCELADA')
                OutlinedButton(
                  style: destino == 'CANCELADA' ? OutlinedButton.styleFrom(foregroundColor: AppColors.danger) : null,
                  onPressed: () => onChange(destino),
                  child: Text(_etiqueta(destino)),
                )
              else
                FilledButton(onPressed: () => onChange(destino), child: Text(_etiqueta(destino))),
          ],
        ),
      ),
    );
  }
}

/// Pide el motivo (obligatorio) al cancelar una orden. Devuelve el texto o `null` si se cancela el diálogo.
class _MotivoCancelacionDialog extends StatefulWidget {
  const _MotivoCancelacionDialog();

  @override
  State<_MotivoCancelacionDialog> createState() => _MotivoCancelacionDialogState();
}

class _MotivoCancelacionDialogState extends State<_MotivoCancelacionDialog> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancelar orden'),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('La orden se conservará como historial con todo lo registrado y ya no podrá modificarse.'),
              const SizedBox(height: AppSpacing.lg),
              TextFormField(
                key: const Key('campo-motivo-cancelacion'),
                controller: _reason,
                autofocus: true,
                maxLength: 255,
                decoration: const InputDecoration(labelText: 'Motivo de la cancelación', counterText: ''),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Indica el motivo de la cancelación.' : null,
              ),
            ],
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
          onPressed: () {
            if (_formKey.currentState!.validate()) Navigator.of(context).pop(_reason.text.trim());
          },
          child: const Text('Confirmar'),
        ),
      ],
    );
  }
}

/// Diálogo de recepción para corregir el problema reportado y reasignar el mecánico.
class _EditarDatosDialog extends StatefulWidget {
  const _EditarDatosDialog({required this.orden, required this.provider});

  final ServiceOrder orden;
  final OrdersProvider provider;

  @override
  State<_EditarDatosDialog> createState() => _EditarDatosDialogState();
}

class _EditarDatosDialogState extends State<_EditarDatosDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _problem;
  List<Mechanic> _mechanics = [];
  int? _mechanicId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _problem = TextEditingController(text: widget.orden.reportedProblem);
    _mechanicId = widget.orden.mechanicId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMechanics());
  }

  @override
  void dispose() {
    _problem.dispose();
    super.dispose();
  }

  Future<void> _loadMechanics() async {
    try {
      final lista = await widget.provider.mechanics();
      if (mounted) setState(() => _mechanics = lista);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  void _guardar() {
    if (!_formKey.currentState!.validate()) return;
    final orden = widget.orden;
    final cambios = <String, dynamic>{
      if (orden.isOpen && _problem.text.trim() != orden.reportedProblem) 'reportedProblem': _problem.text.trim(),
      if (_mechanicId != null && _mechanicId != orden.mechanicId) 'mechanicId': _mechanicId,
    };
    Navigator.of(context).pop(cambios);
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return AlertDialog(
      title: const Text('Editar datos de la orden'),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<int>(
                  key: const Key('campo-mecanico'),
                  initialValue: _mechanicId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Mecánico asignado'),
                  items: [
                    for (final m in _mechanics) DropdownMenuItem(value: m.id, child: Text(m.name)),
                  ],
                  onChanged: (valor) => setState(() => _mechanicId = valor),
                  validator: (v) => v == null ? 'El mecánico es obligatorio.' : null,
                ),
                const SizedBox(height: AppSpacing.lg),
                TextFormField(
                  key: const Key('campo-problema'),
                  controller: _problem,
                  enabled: widget.orden.isOpen,
                  minLines: 2,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'Problema reportado'),
                  validator: (v) {
                    final t = (v ?? '').trim();
                    if (t.isEmpty) return 'El problema reportado es obligatorio.';
                    if (t.length > 2000) return 'El problema reportado no puede tener más de 2000 caracteres.';
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Text(_error!, style: texto.bodyMedium?.copyWith(color: AppColors.danger)),
                ],
              ],
            ),
          ),
        ),
      ),
      actions: [
        OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancelar')),
        FilledButton(onPressed: _guardar, child: const Text('Guardar')),
      ],
    );
  }
}
