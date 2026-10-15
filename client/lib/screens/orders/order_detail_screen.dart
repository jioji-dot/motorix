import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../app_routes.dart';
import '../../models/api_error.dart';
import '../../models/order_status.dart';
import '../../models/payment.dart';
import '../../models/service_order.dart';
import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/inventory_provider.dart';
import '../../providers/orders_provider.dart';
import '../../providers/payments_provider.dart';
import '../../providers/tickets_provider.dart';
import '../../utils/app_theme.dart';
import '../../utils/format.dart';
import '../../widgets/app_shell.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/maintenance_dialog.dart';
import '../../widgets/order_lines_table.dart';
import '../../widgets/order_parts_table.dart';
import '../../widgets/order_payments_section.dart';
import '../../widgets/part_picker_dialog.dart';
import '../../widgets/service_mileage_dialog.dart';
import '../../widgets/panel.dart';
import '../../widgets/state_views.dart';
import '../../widgets/status_chip.dart';
import '../../widgets/text_edit_dialog.dart';
import 'order_form_screen.dart';

/// Detalle de una orden: datos, trabajo técnico, importes e historial de estados.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final int orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<OrdersProvider>().loadDetail(widget.orderId);
    });
  }

  OrdersProvider get _provider => context.read<OrdersProvider>();

  Future<void> _correct(ServiceOrder orden) async {
    final Object? guardada = await Navigator.of(context).pushNamed(
      AppRoutes.orderForm,
      arguments: OrderFormArgs(order: orden),
    );
    if (guardada != null && mounted) _provider.loadDetail(widget.orderId);
  }

  /// Ejecuta una operación sobre la orden mostrando su éxito o el error del servidor.
  Future<void> _run(Future<ServiceOrder> Function() operacion, String exito) async {
    try {
      await operacion();
      if (mounted) showAppSnackBar(context, exito);
    } on ApiError catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    }
  }

  Future<void> _editText({
    required String title,
    required String label,
    required String? actual,
    required Future<ServiceOrder> Function(String texto) guardar,
  }) async {
    final String? texto = await showTextEditDialog(context, title: title, label: label, initial: actual);
    if (texto == null || !mounted) return;
    await _run(() => guardar(texto), '$title: cambios guardados.');
  }

  Future<void> _changeStatus(ServiceOrder orden, OrderStatus hacia) async {
    // Entregar la orden la deja como historial inmodificable: pide confirmación (design-system 8.5).
    if (hacia == OrderStatus.delivered) {
      // Se permite entregar con saldo, pero se avisa cuánto falta por cobrar.
      final PaymentSummary? pago = context.read<PaymentsProvider>().order?.summary ?? orden.payment;
      final bool conSaldo =
          pago != null && pago.status != OrderPaymentStatus.noCharge && pago.balance > 0;
      final bool confirmar = await showConfirmDialog(
        context,
        title: 'Marcar como entregada',
        message: '¿Seguro que quieres marcar la orden ${orden.folio} como entregada? '
            'Después ya no se podrá modificar.'
            '${conSaldo ? ' La orden tiene un saldo pendiente de ${Format.money(pago.balance)}.' : ''}',
      );
      if (!confirmar || !mounted) return;
    }
    await _run(
      () => _provider.changeStatus(orden.id, hacia),
      'La orden ${orden.folio} pasó a ${hacia.label.toLowerCase()}.',
    );
  }

  Future<void> _addService() async {
    final ServiceInput? datos = await showServiceDialog(context);
    if (datos == null || !mounted) return;
    await _run(() => _provider.addService(widget.orderId, datos), 'Servicio agregado.');
  }

  Future<void> _editService(OrderServiceLine linea) async {
    final ServiceInput? datos = await showServiceDialog(context, existing: linea);
    if (datos == null || !mounted) return;
    await _run(() => _provider.updateService(widget.orderId, linea.id, datos), 'Servicio actualizado.');
  }

  Future<void> _removeService(OrderServiceLine linea) async {
    final bool confirmar = await showConfirmDialog(
      context,
      title: 'Quitar servicio',
      message: confirmationText('quitar el servicio "${linea.description}"'),
    );
    if (!confirmar || !mounted) return;
    await _run(() => _provider.removeService(widget.orderId, linea.id), 'Servicio quitado.');
  }

  Future<void> _addLabor() async {
    final LaborInput? datos = await showLaborDialog(context);
    if (datos == null || !mounted) return;
    await _run(() => _provider.addLabor(widget.orderId, datos), 'Mano de obra agregada.');
  }

  Future<void> _editLabor(OrderLaborLine linea) async {
    final LaborInput? datos = await showLaborDialog(context, existing: linea);
    if (datos == null || !mounted) return;
    await _run(() => _provider.updateLabor(widget.orderId, linea.id, datos), 'Mano de obra actualizada.');
  }

  Future<void> _removeLabor(OrderLaborLine linea) async {
    final bool confirmar = await showConfirmDialog(
      context,
      title: 'Quitar mano de obra',
      message: confirmationText('quitar la mano de obra "${linea.description}"'),
    );
    if (!confirmar || !mounted) return;
    await _run(() => _provider.removeLabor(widget.orderId, linea.id), 'Mano de obra quitada.');
  }

  /// El administrador ve la insignia de alertas: tras cambiar refacciones se vuelve a consultar.
  void _refreshAlerts() {
    if (context.read<AuthProvider>().user?.role == UserRole.admin) {
      context.read<InventoryProvider>().refreshAlerts();
    }
  }

  Future<void> _addPart() async {
    final PartSelection? seleccion = await showPartPickerDialog(context);
    if (seleccion == null || !mounted) return;
    await _run(
      () => _provider.addPart(widget.orderId, partId: seleccion.partId, quantity: seleccion.quantity),
      'Refacción agregada.',
    );
    if (mounted) _refreshAlerts();
  }

  Future<void> _editPart(OrderPartLine linea) async {
    final int? cantidad = await showPartQuantityDialog(context, linea);
    if (cantidad == null || !mounted) return;
    await _run(
      () => _provider.updatePartQuantity(widget.orderId, linea.id, cantidad),
      'Cantidad actualizada.',
    );
    if (mounted) _refreshAlerts();
  }

  Future<void> _removePart(OrderPartLine linea) async {
    final bool confirmar = await showConfirmDialog(
      context,
      title: 'Quitar refacción',
      message: '${confirmationText('quitar la refacción "${linea.name}"', irreversible: false)} '
          'Las ${linea.quantity} piezas regresarán al inventario.',
      confirmLabel: 'Quitar',
    );
    if (!confirmar || !mounted) return;
    await _run(() => _provider.removePart(widget.orderId, linea.id), 'Refacción quitada.');
    if (mounted) _refreshAlerts();
  }

  Future<void> _editServiceMileage(ServiceOrder orden) async {
    final int? km = await showServiceMileageDialog(context, orden);
    if (km == null || !mounted) return;
    await _run(
      () => _provider.updateWork(orden.id, serviceMileage: km),
      'Kilometraje de servicio guardado.',
    );
  }

  /// Genera el ticket de la orden (o recupera el existente) y lo abre.
  Future<void> _openTicket(ServiceOrder orden) async {
    try {
      final int id = orden.ticketId ?? (await context.read<TicketsProvider>().generate(orden.id)).ticket.id;
      if (!mounted) return;
      await Navigator.of(context).pushNamed(AppRoutes.ticket, arguments: id);
      if (mounted) _provider.loadDetail(widget.orderId);
    } on ApiError catch (error) {
      if (mounted) showAppSnackBar(context, error.message, isError: true);
    }
  }

  Future<void> _scheduleMaintenance(ServiceOrder orden) async {
    await registerNextMaintenance(
      context,
      orderId: orden.id,
      currentMileage: orden.serviceMileage ?? orden.entryMileage,
    );
  }

  @override
  Widget build(BuildContext context) {
    final OrdersProvider provider = context.watch<OrdersProvider>();
    final AppUser? usuario = context.watch<AuthProvider>().user;
    final ServiceOrder? orden = provider.detail;

    Widget body;
    if (provider.detailLoading || (orden == null && provider.detailError == null)) {
      body = const LoadingView();
    } else if (orden == null) {
      body = ErrorStateView(
        message: provider.detailError ?? 'No se pudo cargar la orden.',
        onRetry: () => provider.loadDetail(widget.orderId),
      );
    } else {
      body = _OrderContent(
        orden: orden,
        onCorrect: () => _correct(orden),
        onChangeStatus: (OrderStatus e) => _changeStatus(orden, e),
        onEditDiagnosis: () => _editText(
          title: 'Diagnóstico',
          label: 'Diagnóstico',
          actual: orden.diagnosis,
          guardar: (String t) => _provider.updateWork(orden.id, diagnosis: t),
        ),
        onEditNotes: () => _editText(
          title: 'Observaciones',
          label: 'Observaciones',
          actual: orden.notes,
          guardar: (String t) => _provider.updateWork(orden.id, notes: t),
        ),
        onEditRecommendations: () => _editText(
          title: 'Recomendaciones',
          label: 'Recomendaciones',
          actual: orden.recommendations,
          guardar: (String t) => _provider.updateWork(orden.id, recommendations: t),
        ),
        onAddService: _addService,
        onEditService: _editService,
        onRemoveService: _removeService,
        onAddLabor: _addLabor,
        onEditLabor: _editLabor,
        onRemoveLabor: _removeLabor,
        onAddPart: _addPart,
        onEditPart: _editPart,
        onRemovePart: _removePart,
        onEditServiceMileage: () => _editServiceMileage(orden),
        canScheduleMaintenance: orden.status.isClosedForWork &&
            usuario != null &&
            (usuario.role == UserRole.admin ||
                (usuario.role == UserRole.mechanic && orden.mechanicId == usuario.id)),
        onScheduleMaintenance: () => _scheduleMaintenance(orden),
        onOpenTicket: () => _openTicket(orden),
        showPayments: usuario != null && usuario.role != UserRole.mechanic && orden.status.isClosedForWork,
        canVoidPayments: usuario?.role == UserRole.admin,
      );
    }

    return AppShell(
      currentRoute: AppRoutes.orders,
      title: 'Detalle de la orden',
      child: body,
    );
  }
}

class _OrderContent extends StatelessWidget {
  const _OrderContent({
    required this.orden,
    required this.onCorrect,
    required this.onChangeStatus,
    required this.onEditDiagnosis,
    required this.onEditNotes,
    required this.onEditRecommendations,
    required this.onAddService,
    required this.onEditService,
    required this.onRemoveService,
    required this.onAddLabor,
    required this.onEditLabor,
    required this.onRemoveLabor,
    required this.onAddPart,
    required this.onEditPart,
    required this.onRemovePart,
    required this.onEditServiceMileage,
    required this.canScheduleMaintenance,
    required this.onScheduleMaintenance,
    required this.onOpenTicket,
    required this.showPayments,
    required this.canVoidPayments,
  });

  final ServiceOrder orden;
  final VoidCallback onCorrect;
  final ValueChanged<OrderStatus> onChangeStatus;
  final VoidCallback onEditDiagnosis;
  final VoidCallback onEditNotes;
  final VoidCallback onEditRecommendations;
  final VoidCallback onAddService;
  final ValueChanged<OrderServiceLine> onEditService;
  final ValueChanged<OrderServiceLine> onRemoveService;
  final VoidCallback onAddLabor;
  final ValueChanged<OrderLaborLine> onEditLabor;
  final ValueChanged<OrderLaborLine> onRemoveLabor;
  final VoidCallback onAddPart;
  final ValueChanged<OrderPartLine> onEditPart;
  final ValueChanged<OrderPartLine> onRemovePart;
  final VoidCallback onEditServiceMileage;
  final bool canScheduleMaintenance;
  final VoidCallback onScheduleMaintenance;
  final VoidCallback onOpenTicket;
  final bool showPayments;
  final bool canVoidPayments;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final bool trabajo = orden.editable.work;
    final bool notas = orden.editable.notesAndRecommendations;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              IconButton(
                tooltip: 'Volver',
                icon: const Icon(LucideIcons.arrowLeft, size: 20),
                onPressed: () => Navigator.of(context).maybePop(),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(orden.folio, style: text.headlineMedium),
              const SizedBox(width: AppSpacing.md),
              StatusChip(label: orden.status.label, color: orden.status.color),
              const Spacer(),
              if (orden.editable.basicData)
                OutlinedButton.icon(
                  onPressed: onCorrect,
                  icon: const Icon(LucideIcons.pencil, size: 18),
                  label: const Text('Corregir datos'),
                ),
            ],
          ),
          if (showPayments) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: onOpenTicket,
                icon: const Icon(LucideIcons.receipt, size: 18),
                label: Text(orden.ticketId == null ? 'Generar ticket' : 'Ver ticket'),
              ),
            ),
          ],
          if (canScheduleMaintenance) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: onScheduleMaintenance,
                icon: const Icon(LucideIcons.calendarClock, size: 18),
                label: const Text('Registrar próximo mantenimiento'),
              ),
            ),
          ],
          if (orden.allowedTransitions.isNotEmpty) ...<Widget>[
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              children: <Widget>[
                for (int i = 0; i < orden.allowedTransitions.length; i++)
                  _statusButton(orden, orden.allowedTransitions[i], destacado: i == 0),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Datos de la orden',
            child: Column(
              children: <Widget>[
                DetailRow(label: 'Cliente', value: orden.clientName),
                DetailRow(label: 'Vehículo', value: '${orden.vehiclePlate} · ${orden.vehicleTitle}'),
                DetailRow(label: 'Mecánico', value: orden.mechanicName ?? 'Sin asignar'),
                DetailRow(label: 'Kilometraje de entrada', value: Format.mileage(orden.entryMileage)),
                DetailRow(
                  label: 'Kilometraje de servicio',
                  value: orden.serviceMileage == null ? '—' : Format.mileage(orden.serviceMileage!),
                ),
                DetailRow(label: 'Fecha de ingreso', value: Format.instant(orden.createdAt)),
                DetailRow(label: 'Problema reportado', value: orden.reportedProblem),
                if (notas)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: OutlinedButton.icon(
                        onPressed: onEditServiceMileage,
                        icon: const Icon(LucideIcons.gauge, size: 18),
                        label: Text(
                          orden.serviceMileage == null
                              ? 'Registrar kilometraje de servicio'
                              : 'Editar kilometraje de servicio',
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Diagnóstico',
            onEdit: trabajo ? onEditDiagnosis : null,
            child: _TextBlock(texto: orden.diagnosis, vacio: 'Aún no hay diagnóstico registrado.'),
          ),
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Servicios realizados',
            child: ServicesTable(
              services: orden.services,
              editable: trabajo,
              onAdd: onAddService,
              onEdit: onEditService,
              onRemove: onRemoveService,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Mano de obra',
            child: LaborTable(
              labor: orden.labor,
              editable: trabajo,
              onAdd: onAddLabor,
              onEdit: onEditLabor,
              onRemove: onRemoveLabor,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Refacciones',
            child: OrderPartsTable(
              parts: orden.parts,
              editable: orden.editable.parts,
              onAdd: onAddPart,
              onEditQuantity: onEditPart,
              onRemove: onRemovePart,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _Totals(orden: orden),
          if (showPayments) ...<Widget>[
            const SizedBox(height: AppSpacing.xl),
            OrderPaymentsSection(
              orderId: orden.id,
              orderStatus: orden.status,
              orderTotal: orden.total,
              canVoid: canVoidPayments,
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Observaciones',
            onEdit: notas ? onEditNotes : null,
            child: _TextBlock(texto: orden.notes, vacio: 'Sin observaciones.'),
          ),
          const SizedBox(height: AppSpacing.xl),
          _Section(
            title: 'Recomendaciones',
            onEdit: notas ? onEditRecommendations : null,
            child: _TextBlock(texto: orden.recommendations, vacio: 'Sin recomendaciones.'),
          ),
          const SizedBox(height: AppSpacing.xl),
          _Section(title: 'Historial de estados', child: _History(cambios: orden.statusHistory)),
        ],
      ),
    );
  }
}

extension on _OrderContent {
  /// Texto del botón según el cambio de estado que ofrece.
  String _statusLabel(OrderStatus desde, OrderStatus hacia) {
    switch (hacia) {
      case OrderStatus.diagnosis:
        return 'Pasar a diagnóstico';
      case OrderStatus.inRepair:
        return desde == OrderStatus.waitingPart ? 'Reanudar reparación' : 'Iniciar reparación';
      case OrderStatus.waitingPart:
        return 'Esperando refacción';
      case OrderStatus.finished:
        return 'Marcar como terminado';
      case OrderStatus.delivered:
        return 'Marcar como entregado';
      case OrderStatus.received:
        return hacia.label;
    }
  }

  Widget _statusButton(ServiceOrder orden, OrderStatus hacia, {required bool destacado}) {
    final String etiqueta = _statusLabel(orden.status, hacia);
    return destacado
        ? FilledButton(onPressed: () => onChangeStatus(hacia), child: Text(etiqueta))
        : OutlinedButton(onPressed: () => onChangeStatus(hacia), child: Text(etiqueta));
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child, this.onEdit});

  final String title;
  final Widget child;

  /// Si se indica, muestra el botón "Editar" junto al título.
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const Spacer(),
            if (onEdit != null)
              TextButton.icon(
                onPressed: onEdit,
                icon: const Icon(LucideIcons.pencil, size: 16),
                label: Text('Editar ${title.toLowerCase()}'),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Panel(padding: const EdgeInsets.all(AppSpacing.lg), child: child),
      ],
    );
  }
}

class _TextBlock extends StatelessWidget {
  const _TextBlock({required this.texto, required this.vacio});

  final String? texto;
  final String vacio;

  @override
  Widget build(BuildContext context) {
    final bool hayTexto = texto != null && texto!.trim().isNotEmpty;
    return SelectableText(
      hayTexto ? texto! : vacio,
      style: hayTexto
          ? Theme.of(context).textTheme.bodyMedium
          : Theme.of(context).textTheme.bodySmall,
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.orden});

  final ServiceOrder orden;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    Widget fila(String etiqueta, double valor, {bool destacar = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: <Widget>[
              Text(etiqueta, style: destacar ? text.bodyLarge : text.bodyMedium),
              const SizedBox(width: AppSpacing.lg),
              SizedBox(
                width: 120,
                child: Text(
                  Format.money(valor),
                  textAlign: TextAlign.right,
                  style: destacar ? text.bodyLarge : text.bodyMedium,
                ),
              ),
            ],
          ),
        );

    return Column(
      children: <Widget>[
        fila('Subtotal de servicios', orden.servicesSubtotal),
        fila('Subtotal de mano de obra', orden.laborSubtotal),
        fila('Subtotal de refacciones', orden.partsSubtotal),
        fila('Total', orden.total, destacar: true),
      ],
    );
  }
}

class _History extends StatelessWidget {
  const _History({required this.cambios});

  final List<StatusChange> cambios;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (final StatusChange c in cambios)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              children: <Widget>[
                SizedBox(width: 150, child: Text(Format.instant(c.createdAt), style: text.bodySmall)),
                if (c.fromStatus != null) ...<Widget>[
                  StatusChip(label: c.fromStatus!.label, color: c.fromStatus!.color),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                    child: Icon(LucideIcons.chevronRight, size: 16),
                  ),
                ],
                StatusChip(label: c.toStatus.label, color: c.toStatus.color),
                const SizedBox(width: AppSpacing.md),
                Flexible(child: Text('por ${c.changedByName}', style: text.bodySmall)),
              ],
            ),
          ),
      ],
    );
  }
}
