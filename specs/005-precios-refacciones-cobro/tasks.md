---

description: "Lista de tareas para implementar el Sprint 5: precios de refacciones y cobro completo"
---

# Tareas: Precios de refacciones y cobro completo

**Entrada**: Documentos de diseño en `specs/005-precios-refacciones-cobro/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md. Sprints 1 a 4 completados y constitución v1.1.0.

**Pruebas**: Se incluyen porque la constitución (principio VII) las exige para la lógica de negocio y los permisos, y la especificación las pide (FR-022). **En cada historia, las pruebas van antes del código**: las de comportamiento nuevo («agrega») deben fallar antes de implementar y se comprueba; las de comportamiento existente («mantiene») deben pasar desde el primer intento, y se verifican con una prueba de mutación (se rompe el código a propósito, la prueba debe fallar y se restaura).

**Organización**: Las tareas se agrupan por historia de usuario. Casi todo el código ya existe (hallazgo H-02): este sprint cambia pocos archivos y agrega sobre todo pruebas. **No hay migración 005 ni seeds nuevos.**

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]–[US5]**: Historia de usuario (US1 reglas y límites de precios, US2 precios ocultos al mecánico, US3 un cambio de precio no altera lo registrado, US4 total, pago y ticket coinciden, US5 datos de ejemplo y documentación)
- Todas las rutas son relativas a la raíz del repositorio

## Convenciones de rutas

- Backend: `server/` (ES Modules, sin carpeta `src/`); pruebas en `server/tests/{unit,integration,contract}/`
- Frontend: `client/lib/` y `client/test/`
- Pruebas del backend: `npm test` en `server/`; del frontend: `flutter test` en `client/`

---

## Fase 1: Preparación

- [X] T001 Confirmar que la rama es `005-precios-refacciones-cobro`, que el árbol de trabajo está limpio y que la línea base sigue verde antes de tocar código: `npm test` en `server/` (75 suites y 1240 pruebas) y `flutter test` en `client/` (242 pruebas) (FR-022)

---

## Fase 2: Fundamentos (bloquean todas las historias)

- [X] T002 [P] Revisar `server/tests/helpers.js` y ampliar lo que falte para las pruebas del sprint: que `crearRefaccion` acepte `purchasePrice` y `salePrice`, y un helper `crearLineaDeRefaccion({ orderId, partId, quantity, unitPrice })` para sembrar líneas con precio sin pasar por la API (FR-022)
- [X] T003 [P] Crear `client/test/helpers/fake_api_s5.dart` con respuestas de la API falsas para el mecánico, recepción y administración: refacciones y órdenes con y sin precios, y un error `PRICE_BELOW_COST` (FR-008, FR-004)
- [X] T004 [P] Actualizar `docs/design-system.md` antes de tocar cualquier pantalla (constitución, principio VIII): agregar a la sección 8.5 (confirmaciones obligatorias) la confirmación de guardar una venta menor al costo, con las palabras «Confirmar» y «Cancelar», y la regla de que las pantallas del mecánico omiten precios y totales sin marcadores de posición (FR-004, FR-008, FR-023)

**Punto de control**: los helpers existen y la suite completa sigue verde.

---

## Fase 3: Historia de usuario 1 - Reglas y límites de los precios (Prioridad: P1)

**Objetivo**: el administrador guarda precios con reglas y límites claros: dos decimales, de 0 a 99,999,999.99, venta menor al costo con confirmación y límite de línea y total.

**Prueba independiente**: se crean y editan refacciones con precios válidos e inválidos y se agregan líneas que rozan el límite; los válidos se guardan y los inválidos se rechazan con un mensaje claro sin dejar datos a medias.

### Pruebas de la historia 1 (escribir primero)

- [X] T005 [P] [US1] Prueba unitaria en `server/tests/unit/orderLimits.test.js`: el límite es inclusivo (9,999,999,999 centavos = 99,999,999.99 se acepta y un centavo más se rechaza); importe de línea = cantidad × precio unitario en centavos; nuevo total = total actual + diferencia (FR-003)
- [X] T006 [P] [US1] Ampliar `server/tests/unit/partService.test.js`: crear o cambiar precios con venta menor a la compra sin `confirmBelowCost` responde `PRICE_BELOW_COST`; con `confirmBelowCost: true` guarda; editar el nombre sin cambiar precios no pide confirmación aunque la venta ya sea menor al costo; venta 0 y compra 0 se permiten (FR-004, FR-004-b)
- [X] T007 [P] [US1] Crear `server/tests/unit/partValidator.test.js`: precios negativos, `abc`, vacío, con tres decimales y mayores a 99,999,999.99 se rechazan con el precio que falla; categoría y marca obligatorias de hasta 60 caracteres; `confirmBelowCost` booleano opcional (FR-001, FR-002)
- [X] T008 [P] [US1] Crear `server/tests/integration/parts.prices.test.js`: el administrador crea y edita una refacción y los cuatro datos persisten (FR-001); precios inválidos responden 400 `VALIDATION_ERROR` con mensaje en español (FR-002); venta menor al costo responde 409 `PRICE_BELOW_COST` y con confirmación guarda (FR-004); precio de venta 0 se guarda (FR-004-b); recepción y mecánico no pueden crear ni cambiar precios (FR-001)
- [X] T009 [P] [US1] Crear `server/tests/integration/orders.limits.test.js`: agregar una refacción o cambiar su cantidad con importe de línea mayor a 99,999,999.99 responde 409 `AMOUNT_LIMIT_EXCEEDED` sin cambiar stock, movimientos, líneas ni total; un total exacto de 99,999,999.99 se acepta; un servicio o una mano de obra que haría pasar el total del máximo se rechaza igual (FR-003, FR-024)
- [X] T010 [P] [US1] Ampliar `server/tests/contract/parts.contract.test.js` y `server/tests/contract/orderParts.contract.test.js` con los errores nuevos `PRICE_BELOW_COST` y `AMOUNT_LIMIT_EXCEEDED` y con el campo `confirmBelowCost` según [contracts/api.md](contracts/api.md) (FR-003, FR-004)
- [X] T011 [P] [US1] Crear `client/test/screens/part_form_test.dart`: guardar con venta menor a la compra abre el diálogo de confirmación; confirmar reenvía con `confirmBelowCost: true` y cancelar no guarda; con venta mayor o igual no aparece el diálogo (FR-004)
- [X] T012 [US1] Ejecutar T005 a T011 y comprobar que fallan las de comportamiento nuevo (límite y venta menor al costo); guardar la salida de `npm test` en `server/` y de `flutter test` en `client/` como evidencia (FR-003, FR-004) **Resultado:** fallaron 16 pruebas de backend (7 suites) y 2 de Flutter, como se esperaba.

### Implementación de la historia 1

- [X] T013 [US1] Crear `server/services/orderLimits.js` (ES Modules, funciones puras): constante del máximo en centavos `9999999999` (precio, línea y total inclusive), cálculo del importe de línea y función que lanza `HttpError(409, 'AMOUNT_LIMIT_EXCEEDED', ...)` con mensaje en español que indica el importe y el máximo permitido (FR-003)
- [X] T014 [US1] Ampliar `server/validators/partValidator.js`: `confirmBelowCost` booleano opcional en el alta y la edición, que no se persiste; precios entre 0 y 99,999,999.99 con dos decimales; categoría y marca de hasta 60 caracteres (FR-001, FR-002, FR-004)
- [X] T015 [US1] Aplicar en `server/services/partService.js` la regla de venta menor al costo en el alta y la edición: si el precio de venta efectivo es menor al de compra, se cambió algún precio y no viene `confirmBelowCost: true`, responder `409 PRICE_BELOW_COST` con el campo `salePrice` en `details` (FR-004, FR-004-b)
- [X] T016 [US1] Aplicar `orderLimits` en `server/services/orderPartService.js` al agregar y al cambiar la cantidad de una línea, dentro de la transacción que ya bloquea la orden y antes de escribir el movimiento, la línea o el total (FR-003, FR-024)
- [X] T017 [US1] Aplicar `orderLimits` en `server/services/orderService.js` al agregar o cambiar un servicio o una mano de obra, con el total bloqueado más la diferencia (FR-003)
- [X] T018 [US1] Mostrar en `client/lib/screens/part_form_screen.dart` el diálogo de confirmación (usando `client/lib/widgets/confirm_dialog.dart`) cuando el servidor responde `PRICE_BELOW_COST`, y reenviar con `confirmBelowCost: true` al confirmar; si hace falta, exponer el código de error en `client/lib/services/api_client.dart` (FR-004)
- [X] T019 [US1] Ejecutar T005 a T011 y comprobar que pasan, y que la suite completa del backend (`npm test` en `server/`) sigue verde; fin del punto de control (FR-003, FR-004)

**Punto de control**: la historia 1 funciona por sí sola.

---

## Fase 4: Historia de usuario 2 - Precios ocultos al mecánico (Prioridad: P1)

**Objetivo**: el mecánico usa las refacciones sin ver ningún precio ni importe de refacciones ni el total de la orden, validado en el servidor. Es el cambio de contrato del hallazgo H-07.

**Prueba independiente**: con una orden con refacciones, se recorren las rutas de lectura con cada rol buscando el precio de compra y el de venta; el mecánico, además, agrega, cambia y quita refacciones normalmente.

### Pruebas de la historia 2 (escribir primero)

- [X] T020 [P] [US2] Ampliar `server/tests/unit/serializers.test.js`: la refacción para el mecánico no trae `purchasePrice` ni `salePrice`; para recepción no trae `purchasePrice`; la orden (detalle y listado) para el mecánico no trae `total` ni `unitPrice` ni `amount` de las refacciones pero conserva servicios y mano de obra con sus importes; el historial no trae `total` ni los precios de las refacciones; el serializador no modifica el original (FR-005, FR-006, FR-008)
- [X] T021 [P] [US2] Crear `server/tests/integration/prices.leak.test.js`: con precio de compra 73.41 y de venta 188.88, recorrer todas las rutas de lectura con cada rol (`GET /api/parts`, `/parts/:id`, `/parts/:id/movements`, `/parts/summary`, `/parts/categories`, `/orders`, `/orders/:id`, `/vehicles/:id/history`, pagos, ticket y `/dashboard`) y buscar en cada respuesta tanto la clave como el valor del precio; con dos controles positivos (el administrador recibe la compra y recepción la venta) para que la prueba no sea vacía (FR-005, FR-006, FR-009, SC-002)
- [X] T022 [P] [US2] Crear `server/tests/integration/orders.mechanicView.test.js`: el mecánico asignado agrega, cambia la cantidad y quita refacciones y ve código, nombre y cantidad de la línea, y la existencia de la refacción (FR-007); las respuestas de las rutas de escritura de servicios, mano de obra y refacciones (que devuelven el detalle) no traen precios ni total; un mecánico no asignado recibe 403; los pagos y el ticket responden 403 (FR-008)
- [X] T023 [P] [US2] Crear `client/test/screens/mechanic_prices_test.dart`: con la sesión del mecánico, las pantallas de órdenes, detalle de orden, refacciones, selector de refacción e historial del vehículo no muestran ningún precio ni total ni ceros o marcadores que parezcan un importe; recepción y administración sí los ven (FR-008)
- [X] T024 [US2] Ejecutar T020 a T023 y comprobar que fallan (hoy el mecánico recibe el precio de venta, los importes y el total); guardar la salida de `npm test` en `server/` y de `flutter test` en `client/` como evidencia (FR-008) **Resultado:** fallaron 4 pruebas de backend y 6 de Flutter, como se esperaba (el servidor aún entregaba precios al mecánico).

### Implementación de la historia 2

- [X] T025 [US2] Ampliar `server/services/serializers.js` con las proyecciones por rol: `serializePart` también quita `salePrice` al mecánico; nuevas `serializeOrder` (detalle), `serializeOrderListItem` y `serializeHistoryItem` que quitan al mecánico el `total` y, de cada línea de refacción, `unitPrice` y `amount` (FR-005, FR-008)
- [X] T026 [US2] Aplicar el serializador de órdenes en `server/services/orderService.js`: en `conPermisos` (usado por el detalle y por todas las rutas de escritura de líneas, `PATCH` y cambio de estado) y en `list` (FR-008, FR-009)
- [X] T027 [US2] Verificar en `server/services/partService.js` que `list`, `get`, `create` y `update` usan el serializador ampliado y que `summary` y `categories` no devuelven precios (FR-005, FR-008)
- [X] T028 [US2] Pasar el usuario a `server/services/vehicleHistoryService.js` desde `server/controllers/historyController.js` y aplicar `serializeHistoryItem` al armar el historial (FR-008)
- [X] T029 [P] [US2] Hacer opcionales los campos `salePrice`, `unitPrice`, `amount` y `total` en `client/lib/models/part.dart`, `client/lib/models/service_order.dart` y `client/lib/models/history_entry.dart` (FR-008)
- [X] T030 [US2] Ocultar los precios y el total cuando no llegan, sin marcadores de posición, en `client/lib/screens/orders_screen.dart` (columna del total), `client/lib/screens/order_detail_screen.dart` (precio por línea y total), `client/lib/screens/parts_screen.dart` y `client/lib/screens/part_detail_screen.dart` (precio de venta), `client/lib/widgets/part_picker_dialog.dart` (precio junto al código) y `client/lib/screens/vehicle_history_screen.dart` (total) (FR-008)

### Ajuste de pruebas por el cambio de contrato (hallazgo H-07)

- [X] T031 [US2] Ejecutar la suite completa del backend y, en las pruebas que fallen solo por las aserciones del rol mecánico, actualizar esas aserciones (candidatas: `server/tests/integration/parts.test.js`, `orderParts.test.js`, `orders.read.test.js`, `orders.lines.test.js`, `vehicleHistory.test.js` y los contratos `parts.contract`, `parts.alerts.contract`, `orderParts.contract`, `orders.read.contract`, `orders.lines.contract` y `vehicleHistory.contract`); ninguna prueba se borra ni se debilita: solo cambia lo que el mecánico ya no recibe (FR-008, SC-006) **Resultado:** ajustadas 17 pruebas en 5 archivos (orderParts.contract, orders.lines.contract, orderParts.test, orders.lines.test y 7 de orderLines.test por el nuevo `computeTotal` del modelo simulado); ninguna se borró ni se debilitó.
- [X] T032 [US2] Ejecutar `flutter test` y actualizar solo las aserciones de las pruebas que fallen por el contrato del mecánico (candidatas: `client/test/screens/orders_screen_test.dart`, `order_parts_test.dart`, `order_work_test.dart`, `parts_screen_test.dart`, `parts_alerts_test.dart` y `vehicle_history_test.dart`) (FR-008, SC-006) **Resultado:** ajustadas 4 pruebas de Flutter (3 de order_parts_test y 1 de parts_screen_test); ninguna se borró ni se debilitó.
- [X] T033 [US2] Registrar en `docs/aseguramiento-calidad-sprint-5.md` (hallazgo H-07) la lista exacta de pruebas ajustadas y la razón de cada una (FR-008, SC-006)
- [X] T034 [US2] Prueba de mutación del recorrido de fugas: hacer que a propósito el mecánico reciba la línea completa en `server/services/orderService.js`, comprobar que fallan T020, T021 y T022, restaurar el código y comprobar que vuelven a pasar (FR-009) **Resultado:** con la fuga forzada fallaron 4 de 10 pruebas; al restaurar pasaron las 19 (serializers, leak y mechanicView).
- [X] T035 [US2] Ejecutar T020 a T023 y comprobar que pasan, y que la suite completa del backend (`npm test` en `server/`) y de Flutter (`flutter test` en `client/`) sigue verde; fin del punto de control (FR-005 a FR-009)

**Punto de control**: el mecánico no recibe precios ni total en ninguna ruta, y las historias 1 y 2 funcionan.

---

## Fase 5: Historia de usuario 3 - Un cambio de precio no altera lo ya registrado (Prioridad: P1)

**Objetivo**: demostrar con pruebas que la línea conserva su precio, que lo emitido no cambia y que agregar, cambiar o quitar una refacción es todo o nada. Es comportamiento existente («mantiene»): se espera que las pruebas pasen desde el primer intento.

**Prueba independiente**: se agrega una refacción, se cambia su precio, y la línea, el total, el pago y el ticket siguen mostrando el precio original; una línea nueva toma el precio vigente.

### Pruebas de la historia 3 (escribir primero)

- [X] T036 [P] [US3] Crear `server/tests/integration/orderParts.prices.test.js`: la línea guarda el precio de venta vigente al agregarla y un cambio posterior del precio no modifica la línea, su importe ni el total (FR-010); una línea agregada después del cambio toma el precio nuevo (FR-014); la misma refacción dos veces responde `DUPLICATE_ORDER_PART` y el precio de una línea se corrige quitándola y agregándola de nuevo con el precio vigente (FR-020); una refacción desactivada conserva el precio de sus líneas y no se agrega a órdenes nuevas (`PART_INACTIVE`)
- [X] T037 [P] [US3] Crear `server/tests/integration/orderParts.prices.concurrency.test.js`: el cambio de precio y el alta de la línea al mismo tiempo, ocho veces; la línea queda con el precio anterior o con el nuevo, nunca con otro valor, también combinado con otra edición o con la desactivación de la refacción (FR-010)
- [X] T038 [P] [US3] Crear `server/tests/integration/emitted.compat.test.js`: con una orden cobrada y su ticket, fotografiar importe y contenido, cambiar el precio de todas las refacciones y comprobar que el pago, el ticket y el total son idénticos (FR-013); una orden Terminada o Entregada no admite agregar, cambiar ni quitar líneas y responde `ORDER_NOT_EDITABLE` (FR-012); los pagos y tickets sembrados por el seed 008 no cambian (FR-013) **Resultado:** el cambio de precio con pago y ticket y el bloqueo de líneas pasaron; los pagos y tickets sembrados por el seed 008 se comprueban en T050 (seeds.sprint5.test.js).
- [X] T039 [P] [US3] Ampliar `server/tests/integration/orderParts.cancel.test.js`: una orden Cancelada conserva sus líneas, sus precios guardados y su total tal como estaban al cancelarse, devuelve las piezas al inventario y no admite pagos (FR-012-b)
- [X] T040 [P] [US3] Crear `server/tests/integration/orderParts.atomic.test.js`: inyectar en `createOrderPartService` (en `server/services/orderPartService.js`) un modelo que falle después del movimiento de inventario y comprobar que no quedó ningún cambio en el stock, los movimientos, las líneas ni el total, al agregar, cambiar la cantidad y quitar (FR-024)
- [X] T041 [US3] Ejecutar T036 a T040 (deben pasar desde el primer intento porque describen comportamiento existente) y hacer una prueba de mutación: hacer que la línea tome el precio del catálogo en `server/services/orderPartService.js`, comprobar que T036 y T037 fallan y restaurar el código (FR-010) **Resultado:** 19 pruebas pasaron de entrada; con el detalle leyendo el precio vivo del catálogo fallaron 5 de 9 y al restaurar pasaron todas.

### Implementación de la historia 3

- [X] T042 [US3] Si T036 a T040 revelan un defecto real, corregirlo en el archivo de servicio o modelo correspondiente (`server/services/orderPartService.js`, `server/models/orderPartModel.js`, `server/models/orderModel.js`), registrarlo como hallazgo en `docs/aseguramiento-calidad-sprint-5.md` y volver a ejecutar; si no hay defectos, dejar constancia de «sin cambios» (FR-010, FR-012, FR-013, FR-024) **Resultado:** sin defectos: no hubo cambios de código en esta historia.

**Punto de control**: el historial de dinero queda demostrado como intacto.

---

## Fase 6: Historia de usuario 4 - Total, pago y ticket coinciden con refacciones (Prioridad: P1)

**Objetivo**: demostrar que el total, el pago, el ticket, el panel y los listados coinciden con refacciones, incluso con mano de obra que requiere redondeo y con cobros simultáneos. Comportamiento existente: se espera que las pruebas pasen desde el primer intento.

**Prueba independiente**: con una orden Terminada con servicios, mano de obra y refacciones, se consulta el total, se paga y se genera el ticket; los tres coinciden.

### Pruebas de la historia 4 (escribir primero)

- [X] T043 [P] [US4] Crear `server/tests/integration/orderTotals.test.js`: el total es servicios + mano de obra + refacciones en centavos; mano de obra de 2.5 h × 99.99 = 249.98 (mitades hacia arriba); el total se recalcula al agregar, cambiar y quitar líneas; una línea con precio 0 suma 0.00 y aparece con importe 0.00 (FR-011, FR-004-b)
- [X] T044 [P] [US4] Crear `server/tests/integration/billing.parts.test.js`: pago por el saldo disponible de una orden con refacciones; un importe mayor al saldo responde `PAYMENT_EXCEEDS_BALANCE` con el saldo; una orden Terminada con solo refacciones y total mayor a cero se cobra y una de total cero no; ocho cobros simultáneos nunca superan el total; el cobro de Mercado Pago con la pasarela simulada (`server/tests/fakeGateway.js`) solicita el importe correcto; ninguna respuesta ni dato guardado contiene datos de tarjeta (FR-015, FR-016, FR-017)
- [X] T045 [P] [US4] Crear `server/tests/integration/tickets.parts.test.js`: el ticket muestra por cada refacción cantidad, precio unitario e importe, y su subtotal coincide con el total de la orden, también con un pago parcial (FR-018, SC-003)
- [X] T046 [P] [US4] Crear `server/tests/integration/dashboard.listings.regression.test.js`: con órdenes con refacciones, el panel, el listado de órdenes y el listado de pagos muestran totales, cobrado y pendiente que coinciden con las órdenes y los pagos de origen, y el mecánico no ve totales en el listado (FR-019, FR-008)
- [X] T047 [P] [US4] Ampliar `client/test/screens/ticket_screen_test.dart` y `client/test/screens/order_payments_test.dart` con una orden con refacciones: recepción ve el total con refacciones, el saldo y el ticket con cada refacción (FR-018, FR-019) **Resultado:** se amplió ticket_screen_test.dart con la prueba de cada refacción y el total; order_payments_test.dart no se tocó porque ya cubre el resumen de cobro con total.
- [X] T048 [US4] Ejecutar T043 a T047 (deben pasar desde el primer intento) y hacer una prueba de mutación: hacer que `recalculateTotal` en `server/models/orderModel.js` omita las refacciones, comprobar que T043, T044 y T045 fallan y restaurar el código (FR-011, FR-018) **Resultado:** con el recálculo sin refacciones fallaron 12 de 17 pruebas; al restaurar pasaron las 17. El ayudante de pruebas usa la fórmula real del total para que la mutación se detecte.

### Implementación de la historia 4

- [X] T049 [US4] Si T043 a T047 revelan un defecto real, corregirlo en `server/models/orderModel.js`, `server/services/paymentService.js`, `server/services/ticketBuilder.js` o `server/services/dashboardService.js`, registrarlo como hallazgo en `docs/aseguramiento-calidad-sprint-5.md` y volver a ejecutar; si no hay defectos, dejar constancia de «sin cambios» (FR-011, FR-015 a FR-019) **Resultado:** sin defectos: no hubo cambios de código en esta historia.

**Punto de control**: el flujo total, pago y ticket queda demostrado de extremo a extremo.

---

## Fase 7: Historia de usuario 5 - Datos de ejemplo y documentación al día (Prioridad: P2)

**Objetivo**: confirmar que los datos de ejemplo bastan sin seeds nuevos y que la documentación no contradice el cobro con refacciones.

**Prueba independiente**: un entorno recién instalado muestra refacciones con precios y una orden Terminada cobrable con refacciones; cargar los seeds dos veces no duplica nada.

### Prueba de la historia 5 (escribir primero)

- [X] T050 [US5] Crear `server/tests/integration/seeds.sprint5.test.js` y un helper `aplicarSeeds` en `server/tests/helpers.js` que ejecute primero el seed de usuarios, clientes y vehículos (`server/scripts/seed.js`) y después lea `database/seeds/*.sql` en orden y los ejecute dos veces sobre `motorix_test`: los conteos por tabla no cambian en la segunda carga, hay refacciones con precio, una orden Terminada con refacciones y saldo pendiente (como OS-000005) y una Entregada pagada (como OS-000006) (FR-021, SC-007) **Resultado:** 5 de 5 pruebas: los seeds cargan dos veces sin duplicar y hay una orden Terminada con refacciones y saldo pendiente y una Entregada pagada.

### Implementación de la historia 5

- [X] T051 [P] [US5] Actualizar `docs/project-context.md`: la entidad `Part` y la sección de refacciones y pagos con la visibilidad de precios por rol (el mecánico no ve ningún precio ni el total), los límites de importes, la confirmación de la venta menor al costo y que el precio se guarda en la línea de la orden (FR-023)
- [X] T052 [P] [US5] Buscar con `grep` en `server/`, `client/lib/`, `README.md` y `database/README.md` comentarios o textos que afirmen que las refacciones no suman al cobro, que no tienen precio o que el mecánico ve precios, y actualizarlos; dejar constancia del resultado de la búsqueda (FR-023) **Resultado:** la búsqueda no encontró comentarios ni textos desfasados.
- [X] T053 [US5] Comprobar con `git diff --stat main -- database/` que no se modificó ninguna migración ni seed y que no existe `005_*.sql`; registrar el resultado (FR-021, FR-022) **Resultado:** sin cambios en database/ y sin 005_*.sql.

**Punto de control**: datos de ejemplo y documentación verificados.

---

## Fase 8: Cierre y regresión

- [X] T054 Ejecutar la suite completa del backend (`npm test` en `server/`) y comprobar que ninguna prueba de los Sprints 1 a 4 pasó de verde a rojo, salvo las ajustadas y registradas en H-07; guardar el resumen para la captura de cierre (FR-022, SC-006) **Resultado:** 90 suites y 1332 pruebas aprobadas, 0 fallidas (línea base: 75 suites y 1240).
- [X] T055 Ejecutar `flutter test` y `flutter analyze lib` en `client/` y `npm run lint` en `server/`; guardar el resumen para la captura de cierre (FR-022, SC-006) **Resultado:** 256 pruebas de Flutter aprobadas, 0 fallidas (línea base: 242); flutter analyze lib y npm run lint sin problemas.
- [X] T056 Recorrer los 12 escenarios de [quickstart.md](quickstart.md) contra la API real sobre `motorix_test` con un guion temporal en el directorio de trabajo temporal, y registrar el resultado en `specs/005-precios-refacciones-cobro/validacion-quickstart.md` (FR-022, SC-001, SC-002, SC-003, SC-005) **Resultado:** 12 de 12 escenarios correctos; ver validacion-quickstart.md.
- [X] T057 Medir con una persona y cronómetro SC-004 (cobrar una orden Terminada con refacciones y generar su ticket, desde el detalle de la orden hasta ver el ticket) y registrar el tiempo real, o dejar constancia de que no se midió, en `docs/aseguramiento-calidad-sprint-5.md` (SC-004) **Resultado:** no se midió con cronómetro, por lo que no se registra ningún valor; queda como observación en el cierre.
- [X] T058 Actualizar `docs/aseguramiento-calidad-sprint-5.md`: trazabilidad (sección 6), riesgos (sección 5), regresión de cierre (sección 8), hallazgos (sección 7), matriz final (sección 9) y anexo de evidencias, solo con datos verificados; la aprobación final es del responsable del proyecto (FR-022, SC-006) **Resultado:** documento completo y aprobado por el responsable el 2026-11-03.
- [X] T059 [P] Actualizar `README.md` con el Sprint 5 y la referencia a `specs/005-precios-refacciones-cobro/` (FR-023)

---

## Dependencias y orden de ejecución

- **Preparación (T001)** y **Fundamentos (T002 a T004)**: bloquean todo lo demás; T004 (`docs/design-system.md`) debe estar lista antes de cualquier cambio de pantalla (T018 y T030).
- **US1 (T005 a T019)** y **US2 (T020 a T035)** tocan el mismo servicio de refacciones (`server/services/partService.js`): se hacen en orden, US1 primero. Dentro de cada historia: pruebas, comprobar que fallan, código y verificación.
- **US3 y US4 (T036 a T049)** solo demuestran comportamiento existente y no dependen de US1 ni de US2, salvo que sus pruebas leen respuestas ya serializadas; conviene hacerlas después de US2; en particular, T046 (US4) comprueba el ocultamiento de totales al mecánico y depende de T026 (US2) para no volver a ajustarlas.
- **US5 (T050 a T053)** puede empezar al terminar los fundamentos, pero su verificación final va después de las demás.
- **Cierre (T054 a T059)** al final.

Orden sugerido: T001 → T002/T003 → US1 → US2 → US3 → US4 → US5 → cierre.

## Oportunidades de paralelismo

- T002 y T003 son independientes.
- Las pruebas de una misma historia (marcadas `[P]`) están en archivos distintos y se pueden escribir en paralelo: por ejemplo T005 a T011 en US1 y T036 a T040 en US3.
- T029 (modelos del cliente) y T051 a T052 (documentación) no dependen del código del backend.

## Estrategia de implementación

1. **Alcance mínimo demostrable**: US1 + US2, que son los únicos cambios de comportamiento (límites, confirmación y ocultamiento de precios). Con ellas el sprint ya cumple sus requisitos «agrega».
2. **Entrega incremental**: US3 y US4 convierten en evidencia lo que el MVP ya hace (precio guardado, totales, pagos, tickets); US5 cierra datos de ejemplo y documentación.
3. **Regla de calidad**: cada historia termina con su punto de control (pruebas nuevas y suite completa en verde) y con un commit pequeño.

## Cobertura de requisitos

| Requisito | Tareas |
|-----------|--------|
| FR-001 | T007, T008, T014 |
| FR-002 | T007, T008, T014 |
| FR-003 | T005, T009, T010, T013, T016, T017 |
| FR-004 | T004, T006, T008, T010, T011, T014, T015, T018 |
| FR-004-b | T006, T008, T015, T043 |
| FR-005 | T020, T021, T025, T027 |
| FR-006 | T020, T021 |
| FR-007 | T022 |
| FR-008 | T003, T004, T020, T022 a T032, T046 |
| FR-009 | T021, T026, T034 |
| FR-010 | T036, T037, T041 |
| FR-011 | T043, T048 |
| FR-012 | T038 |
| FR-012-b | T039 |
| FR-013 | T038 |
| FR-014 | T036 |
| FR-015 | T044 |
| FR-016 | T044 |
| FR-017 | T044 |
| FR-018 | T045, T047, T048 |
| FR-019 | T046, T047 |
| FR-020 | T036 |
| FR-021 | T050, T053 |
| FR-022 | T001, T053 a T056 (y todas las pruebas de las fases 3 a 7) |
| FR-023 | T004, T051, T052, T059 |
| FR-024 | T009, T016, T040 |

Cada una de las 59 tareas cita al menos un requisito o criterio de éxito (SC-001 a SC-007), con excepción de las de preparación y cierre, que citan FR-022.
