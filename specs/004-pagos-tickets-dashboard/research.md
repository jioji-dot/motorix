# Investigación (Fase 0): Pagos, tickets y panel de control

No quedaron marcadores `NEEDS CLARIFICATION`. Se mantienen las decisiones técnicas de los sprints anteriores; aquí se consolidan las específicas de este sprint y se resuelven las dos decisiones pendientes de la constitución (implementación de PDF/tickets y alcance de Mercado Pago).

## 1. Saldo de la orden: bloqueo de la orden y suma de pagos reservados

- **Decisión**: cada alta de pago abre una transacción, bloquea la orden con `SELECT ... FOR UPDATE` (el mismo mecanismo de los sprints 2 y 3), calcula `reservado = SUM(importe de pagos PAGADO y PENDIENTE)` y acepta el pago solo si `importe <= total - reservado`. Los pagos Pendientes de Mercado Pago reservan su importe para no sobrecobrar mientras esperan; los Rechazados y Cancelados liberan el saldo. El estado de cobro de la orden (Sin pagos, Pago parcial, Pagada) se calcula con los pagos Pagados y no se guarda.
- **Justificación**: el bloqueo de la orden serializa los cobros de una misma orden sin afectar a las demás (FR-005, SC-002) y reutiliza el patrón ya probado con el stock. Calcular el estado de cobro evita desincronizaciones.
- **Alternativas**: una columna `paid` en la orden (se desincroniza si falla algo); restricción en la base (MySQL no puede validar una suma entre filas); bloqueo optimista con reintentos (más complejo).

## 2. Estados del pago y reglas de transición

- **Decisión**: los métodos efectivo, tarjeta y transferencia nacen `PAGADO` (un `CHECK` de la tabla lo exige: solo `MERCADO_PAGO` puede tener otro estado al crearse). Mercado Pago nace `PENDIENTE` y solo puede pasar a `PAGADO`, `RECHAZADO` o `CANCELADO`; los tres son finales y se aplican con `UPDATE ... WHERE status = 'PENDIENTE'`, de modo que una notificación repetida no cambia nada (idempotencia, FR-015). Los pagos nunca se eliminan ni se editan.
- **Justificación**: coincide con los estados sugeridos del contexto del proyecto y con la aclaración de que no hay reembolsos. La actualización condicionada hace seguro el reintento de notificaciones y la carrera entre una notificación y una consulta manual.
- **Alternativas**: máquina de estados completa con reembolsos (fuera de alcance por aclaración).
- **Límite aceptado**: si recepción cancela un pago Pendiente y luego Mercado Pago informa que ese enlace sí se pagó, el cambio se ignora y se registra una advertencia en el servidor (sin datos sensibles); el dinero recibido se concilia fuera de Motorix. Se documenta como riesgo conocido del MVP.

## 3. Mercado Pago: enlace de pago con Checkout Pro, sin SDK

- **Decisión** (aclaración 1): al iniciar un pago con Mercado Pago, el servidor crea una **preferencia de pago** (`POST /checkout/preferences`) con el importe, la descripción ("Orden OS-000123") y una `external_reference` propia y única por pago; guarda el pago `PENDIENTE` con el enlace (`sandbox_init_point` con credenciales de prueba) y lo devuelve. El cliente paga en la página de Mercado Pago. El llamado se hace con el `fetch` nativo de Node 24, sin SDK ni dependencia nueva.
- **Justificación**: el enlace es la opción más sencilla y segura (Motorix nunca ve datos de tarjeta, RN-14), se prueba de punta a punta con cuentas de prueba del sandbox y no necesita una librería (la constitución pide no agregar librerías para lo que se resuelve con pocas líneas).
- **Alternativas**: checkout incrustado (más frontend y más riesgo con datos de tarjeta); SDK oficial (dependencia innecesaria); simulación local (no cumple el criterio de integrar el sandbox).

## 4. Mercado Pago aislado en una pasarela intercambiable

- **Decisión**: `server/integrations/mercadoPagoGateway.js` es la única pieza que conoce la API externa y expone tres operaciones: `createPaymentLink`, `getPayment` y `isConfigured`. `paymentService` y `mercadoPagoService` reciben la pasarela por inyección, igual que los modelos en los demás servicios, por lo que las pruebas usan un simulador y nunca llaman a Mercado Pago. Tiempo de espera de 10 segundos; errores de red o de respuesta se traducen a `MP_UNAVAILABLE` (502) y la falta de credenciales a `MP_NOT_CONFIGURED` (503), sin crear pagos a medias (FR-017, FR-018).
- **Justificación**: cumple "la lógica específica de integración debe mantenerse aislada del dominio principal" y hace comprobables los casos de error.
- **Alternativas**: llamar a la API desde el servicio de pagos (acopla el dominio y obliga a pruebas con red).

## 5. Credenciales y configuración por variables de entorno

- **Decisión**: variables nuevas en `.env.example` sin valores: `MP_ACCESS_TOKEN` (credencial de pruebas), `MP_WEBHOOK_SECRET` (opcional, para validar la firma de las notificaciones), `MP_NOTIFICATION_URL` (dirección pública del webhook; opcional en local) y los datos del taller `WORKSHOP_NAME`, `WORKSHOP_ADDRESS`, `WORKSHOP_PHONE` con valores por defecto. El token jamás se escribe en respuestas, registros ni pruebas (CA-7, FR-016).
- **Justificación**: sigue el patrón del resto de la configuración; los datos del taller no necesitan una pantalla de administración (supuesto de la especificación).
- **Alternativas**: tabla de configuración editable (alcance extra).

## 6. Notificaciones de Mercado Pago: públicas, verificadas e idempotentes

- **Decisión**: `POST /api/payments/mercadopago/webhook` es la única ruta sin sesión del sprint. No confía en el contenido recibido: toma solo el identificador del pago de Mercado Pago, consulta su estado real a la API de Mercado Pago (`getPayment`), localiza el pago local por `external_reference`, comprueba que el importe coincida y aplica el estado con la actualización condicionada del punto 2. Si hay `MP_WEBHOOK_SECRET`, además valida la firma `x-signature`. Responde siempre 200 a notificaciones bien formadas (aunque no correspondan a ningún pago) para evitar reintentos infinitos, y 400 a las mal formadas.
- **Justificación**: una notificación falsa no puede aprobar un pago porque el estado se obtiene de la fuente (FR-015); la idempotencia sale de la actualización condicionada. En local, sin dirección pública, el estado se actualiza con el botón "Actualizar estado" (`POST /payments/:id/sync`) que usa la misma lógica.
- **Alternativas**: confiar en el cuerpo de la notificación (inseguro); exigir siempre el túnel público (inviable en la demostración local).

## 7. Ticket: vista imprimible que se arma al consultarla (aclaración 2)

- **Decisión**: el ticket guarda solo `folio` (`TK-000123`, único), la orden (única: a lo sumo un ticket por orden), el pago principal relacionado y la fecha. Su contenido (taller, cliente, vehículo, líneas, subtotal, total, método y estado de pago) se **arma en cada consulta** con los datos vigentes de la orden y sus pagos. Generar de nuevo devuelve el mismo ticket (FR-021). No se generan ni guardan PDF.
- **Justificación**: coincide con la aclaración y con el principio de no duplicar información: el ticket nunca queda desactualizado respecto a los pagos y los importes siempre coinciden con la orden (FR-023).
- **Alternativas**: guardar un JSON o PDF con el contenido (copias que pueden desactualizarse); generar PDF con una librería (descartado por la aclaración).

## 8. Impresión: página HTML con token de corta vida

- **Decisión**: la aplicación Flutter de escritorio no tiene un diálogo de impresión propio, así que el servidor entrega el ticket como una **página HTML con estilos de impresión** (`@media print`, sin menús) que ejecuta `window.print()` al abrirse. Como el navegador no envía el encabezado `Authorization`, el servidor emite un **token de impresión** (`POST /orders/:id/ticket/print-link`) firmado con una clave derivada distinta de la sesión, con vigencia de 5 minutos y limitado a esa orden; `GET /api/tickets/print/:token` valida el token y devuelve el HTML. El texto del ticket se escapa para evitar inyección de HTML.
- **Justificación**: cumple "visualizar e imprimir" y "guardar como PDF desde el diálogo del sistema" sin generar archivos; al firmarse con otra clave, un token de impresión no sirve como sesión y viceversa. Se requiere `url_launcher` para abrir el navegador del sistema.
- **Alternativas**: paquete `printing` (genera PDF en memoria; contradice la aclaración); dibujar el ticket en Flutter e imprimirlo (Flutter de escritorio no expone la impresión del sistema); exponer una ruta de impresión sin token (insegura).

## 9. Dependencias nuevas del frontend

- **Decisión**: `url_launcher` (paquete oficial de Flutter; abre el enlace de impresión y el enlace de Mercado Pago en el navegador) y `qr_flutter` (paquete de Dart puro que dibuja un código QR a partir de un texto). Se justifican porque ninguna de las dos funciones se puede resolver con pocas líneas de código; ambas son pequeñas, mantenidas y gratuitas.
- **Alternativas**: omitir el QR (la aclaración lo menciona como alternativa del enlace; se conserva por comodidad del cobro en mostrador); copiar el enlace sin abrirlo (peor experiencia).

## 10. Panel de control: agregados calculados al abrir, reutilizando los módulos

- **Decisión** (aclaración 5): `GET /api/dashboard` (solo administrador) devuelve cifras calculadas con consultas agregadas, sin tabla ni caché: órdenes por estado y terminadas/entregadas con saldo pendiente; citas pendientes o confirmadas de hoy y de los próximos 7 días; mantenimientos vencidos y próximos (reutiliza el clasificador del Sprint 3); refacciones con stock bajo y agotadas, más las 5 más urgentes (reutiliza el resumen del Sprint 3); y lo cobrado hoy y en el mes en curso (pagos `PAGADO` por fecha de pago, hora local del taller) junto con lo pendiente de cobrar. Cada bloque llama a los modelos y servicios existentes en lugar de repetir sus reglas, por lo que las cifras coinciden con las de cada módulo (FR-027, SC-007).
- **Justificación**: sin duplicar información (CA-6) y con el menor mantenimiento; la coincidencia se comprueba en pruebas de integración que comparan el panel contra los endpoints de cada módulo.
- **Alternativas**: tablas de resumen o vistas materializadas (copias que se desactualizan); gráficos con `fl_chart` (alcance extra; las cifras en tarjetas bastan para el MVP).

## 11. Concurrencia entre notificación, consulta manual y cancelación

- **Decisión**: las tres operaciones sobre un pago Pendiente (notificación, sincronización y cancelación) usan la misma actualización condicionada `WHERE status = 'PENDIENTE'` dentro de una transacción; gana la primera y las demás reciben el estado ya final sin error (la cancelación responde 409 `PAYMENT_NOT_PENDING`).
- **Justificación**: evita estados contradictorios y duplicados sin bloqueos largos.
- **Alternativas**: bloqueo de la fila del pago antes de llamar a Mercado Pago (retiene una transacción durante una llamada de red).

## 12. Importes y redondeo

- **Decisión**: `DECIMAL(10,2)` en `payments.amount`, comparaciones y sumas en la base de datos o con aritmética en centavos enteros en el servicio; el servidor nunca suma decimales de punto flotante. El subtotal del ticket se calcula con la misma suma de líneas que el total de la orden (sin impuestos, por lo que subtotal = total).
- **Justificación**: la suma de pagos nunca puede exceder el total por redondeo (caso límite de la especificación).
- **Alternativas**: números de punto flotante (error de redondeo).

## 13. Datos de ejemplo idempotentes

- **Decisión**: `008_payments_tickets.sql` inserta pagos solo si la orden no tiene ya uno con la misma referencia de ejemplo, calcula los importes con el total real de cada orden (una orden Entregada cobrada en efectivo y tarjeta, una Terminada con pago parcial por transferencia y un pago de Mercado Pago Rechazado de historial) y genera el ticket de la orden entregada. Se carga con `npm run seed` después de los seeds 001 a 007.
- **Justificación**: el panel y las pantallas muestran información al instalar sin capturar nada (FR-032, SC-008).

## 14. Pruebas

- **Decisión**: unitarias para el saldo, las transiciones, la pasarela simulada, la verificación del webhook, el token de impresión y el armado del ticket; integración con concurrencia (cobros simultáneos que exceden el saldo, notificaciones repetidas) y coincidencia de cada cifra del panel con su módulo; contrato de cada endpoint; una prueba que inspecciona el esquema para asegurar que no existen columnas de datos de tarjeta; matriz de permisos con los endpoints nuevos; pruebas de widgets para los pagos, el diálogo de Mercado Pago, el ticket y el panel; y la prueba de diseño adaptable con las pantallas nuevas.
- **Justificación**: principio VII de la constitución y criterio CA-8 del sprint.
