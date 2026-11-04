# Lista de calidad de requisitos de cobro y visibilidad de precios: Precios de refacciones y cobro completo

**Propósito**: Revisar la calidad de los requisitos de la especificación (completitud, claridad, consistencia, medibilidad y cobertura) sobre el cálculo del total, el precio guardado en la línea, la integridad de pagos y tickets emitidos, los límites de importes, los permisos por rol y el cambio de contrato del mecánico (FR-008). No prueba la implementación.
**Creado**: 2026-11-03
**Funcionalidad**: [spec.md](../spec.md)
**Profundidad**: revisor formal (puerta de calidad antes de planificar). **Audiencia**: el responsable del proyecto como revisor.

**Nota**: Esta lista la genera el comando `/speckit-checklist` a partir de la especificación del sprint.
**Responsable de la revisión**: esta lista es un artefacto de revisión de la calidad de los requisitos. Marca un punto con `[x]` solo cuando el revisor determine que el criterio de calidad se cumple.
**Significado de las marcas**: `[x]` significa que el criterio se revisó y se cumple en los requisitos. No significa que la implementación esté hecha.

## Completitud de los requisitos

- [x] CHK001 ¿Está definido el momento exacto en que el precio de venta se copia a la línea (al agregar, al confirmar la orden o al cambiar de estado)? [Completitud, Spec §FR-010]
- [x] CHK002 ¿Se especifica qué pasa con el total cuando se agrega un servicio o mano de obra que lo haría superar el máximo, y no solo una refacción? [Laguna, Spec §FR-003]
- [x] CHK003 ¿Se define un límite para la cantidad de una línea de refacción, además de los límites de precio, línea y total? [Laguna, Spec §FR-003]
- [x] CHK004 ¿Se define cómo se expresa la confirmación explícita de una venta menor al costo (qué envía quien llama y qué responde el sistema sin ella)? [Claridad, Spec §FR-004]
- [x] CHK005 ¿Se indica si la confirmación de FR-004 se vuelve a pedir al editar otros datos de una refacción que ya tiene la venta menor al costo? [Cobertura, Spec §FR-004]
- [x] CHK006 ¿Se definen los requisitos para una orden Cancelada: qué pasa con sus líneas de refacción, su total y los precios guardados? [Laguna, Spec §FR-010, FR-011]
- [x] CHK007 ¿Se define qué ve la interfaz del mecánico donde antes aparecían los precios y el total (ocultar la columna, mostrar un guion u otro)? [Laguna, Spec §FR-008]
- [x] CHK008 ¿Se establece si los importes de servicios y mano de obra que sigue viendo el mecánico permiten deducir el total oculto, y si eso es aceptable? [Ambigüedad, Spec §FR-008, Supuestos]
- [x] CHK009 ¿Se define quién puede cambiar el precio de venta de una refacción, y si el cambio deja registro de quién y cuándo? [Laguna, Spec §FR-001]
- [x] CHK010 ¿Se especifica si la categoría y la marca son texto libre o una lista, y sus longitudes máximas? [Laguna, Spec §FR-001]
- [x] CHK011 ¿Se define qué ocurre con el precio guardado de las líneas cuando una refacción se desactiva? [Cobertura, Casos límite]

## Claridad de los requisitos

- [x] CHK012 ¿Se usa un único término para cada concepto de dinero (precio guardado, precio unitario, precio vigente, importe, monto, saldo, saldo disponible)? [Terminología, Spec §FR-010, FR-015, Entidades clave]
- [x] CHK013 ¿Está definido «saldo» en FR-015 con la misma regla que «saldo disponible» del Sprint 4 (incluye los pagos pendientes de Mercado Pago)? [Claridad, Spec §FR-015]
- [x] CHK014 ¿«DEBEN funcionar» en FR-019 está cuantificado con un resultado observable (qué totales y qué pantallas)? [Ambigüedad, Spec §FR-019]
- [x] CHK015 ¿«Mensaje claro» está definido con criterios comprobables (qué dato falla, el valor permitido, idioma)? [Ambigüedad, Spec §FR-002, FR-003, SC-005]
- [x] CHK016 ¿Se define qué significa que los datos de ejemplo del Sprint 4 «sigan intactos» y cómo se comprueba? [Medibilidad, Spec §FR-013]
- [x] CHK017 ¿«Mecánico asignado» y «otro mecánico» están diferenciados en los requisitos de visibilidad? [Claridad, Spec §FR-007, FR-008]
- [x] CHK018 ¿Queda claro si «el mecánico no recibe el total de la orden» incluye el listado, el detalle, el historial del vehículo y las notificaciones, o solo los dos primeros? [Ambigüedad, Spec §FR-008]

## Consistencia de los requisitos

- [x] CHK019 ¿FR-016 («solo el total cero impide el cobro») es consistente con la regla del Sprint 4 de que solo se cobran órdenes Terminadas o Entregadas? [Conflicto, Spec §FR-016]
- [x] CHK020 ¿La obligación de mostrar el importe de cada línea en el ticket (FR-018) es consistente con la prohibición de mostrar importes al mecánico (FR-008) si el mecánico pudiera ver el ticket? [Consistencia, Spec §FR-008, FR-018]
- [x] CHK021 ¿FR-012 («las órdenes Terminadas no admiten cambios de líneas») es consistente con la historia 3, escenario 5, y con la suposición sobre D-06? [Consistencia, Spec §FR-012, Supuestos]
- [x] CHK022 ¿Los requisitos marcados «mantiene» describen el comportamiento real del código, sin mezclar lo que el sprint agrega? [Consistencia, Spec §FR-001, FR-010 a FR-019]
- [x] CHK023 ¿FR-005 (precio de compra solo del administrador) y FR-006 (recepción ve venta e importes) cubren los mismos recursos sin contradecirse? [Consistencia, Spec §FR-005, FR-006]
- [x] CHK024 ¿El máximo de 99,999,999.99 se expresa igual en FR-002, FR-003 y en las aclaraciones? [Consistencia, Spec §FR-002, FR-003]

## Calidad de los criterios de aceptación y de éxito

- [x] CHK025 ¿Se puede medir SC-004 («menos de 2 minutos»): están definidos el punto de inicio, el punto final, el usuario y los datos? [Medibilidad, Spec §SC-004]
- [x] CHK026 ¿«Importes que requieren redondeo» (historia 4, SC-003) existen de verdad, dado que la cantidad es entera y el precio tiene dos decimales? [Ambigüedad, Spec §SC-003, Historia 4]
- [x] CHK027 ¿Se define la regla de redondeo (a qué centavo y con qué criterio) para las líneas donde sí puede ocurrir, como la mano de obra por horas? [Laguna, Spec §FR-011]
- [x] CHK028 ¿SC-001 y SC-002 («100 % de los casos de prueba / de las rutas probadas») indican el conjunto de casos y de rutas, y no solo el porcentaje? [Medibilidad, Spec §SC-001, SC-002]
- [x] CHK029 ¿Cada requisito funcional nuevo (FR-003, FR-004, FR-008, FR-014, FR-022, FR-023) tiene un escenario de aceptación o un criterio de éxito que lo cubra? [Trazabilidad, Spec §FR]
- [x] CHK030 ¿SC-006 define cómo se decide qué pruebas anteriores pueden cambiar y cómo se registran? [Medibilidad, Spec §SC-006]

## Cobertura de escenarios y casos límite

- [x] CHK031 ¿Se cubre el cambio de precio simultáneo con el alta de la línea, y también con la desactivación de la refacción o con otra edición de la misma refacción? [Cobertura, Spec §FR-010]
- [x] CHK032 ¿Se define el comportamiento ante un fallo parcial al agregar una refacción (el movimiento de inventario se guarda pero la línea no)? [Recuperación, Spec §FR-003, FR-010]
- [x] CHK033 ¿Se cubre el cobro con Mercado Pago cuando la orden ya tiene un pago pendiente y el administrador cambia precios? [Cobertura, Casos límite]
- [x] CHK034 ¿Se define qué debe ocurrir si el total almacenado de una orden anterior al sprint no coincide con la suma de sus líneas (datos de ejemplo insertados directamente)? [Suposición, Spec §FR-011, FR-013]
- [x] CHK035 ¿Se cubre el caso de una refacción con precio de venta 0 en el total, el pago y el ticket (una línea de importe 0)? [Caso límite, Spec §FR-004-b]
- [x] CHK036 ¿Se cubre la orden cuyo total llega exactamente al máximo permitido (límite inclusivo o exclusivo)? [Caso límite, Spec §FR-003]

## Requisitos no funcionales

- [x] CHK037 ¿Se exige que la restricción de visibilidad se cumpla en todas las rutas actuales y futuras, y se define cómo se detecta una ruta nueva olvidada? [Seguridad, Spec §FR-009]
- [x] CHK038 ¿Se definen requisitos de registro o auditoría cuando el administrador confirma una venta menor al costo? [Laguna, Spec §FR-004]
- [x] CHK039 ¿Se define el efecto del cambio de contrato del mecánico (FR-008) sobre las pruebas y pantallas existentes, y cómo se registra? [Dependencia, Spec §FR-008, SC-006]
- [x] CHK040 ¿Se establece que una migración nueva, si hace falta, sea reversible o segura ante un fallo a medias? [Recuperación, Spec §Supuestos]

## Dependencias y supuestos

- [x] CHK041 ¿Está validada la suposición de que ninguna refacción ni línea existente carece de precio, dado que las columnas lo exigen? [Suposición, Spec §Supuestos]
- [x] CHK042 ¿Está documentada la dependencia de Mercado Pago (modo de pruebas y proveedor simulado) para comprobar FR-017? [Dependencia, Spec §FR-017]
- [x] CHK043 ¿Existe una fuente única de verdad para las decisiones D-01 a D-07, sin que la especificación y el insumo se contradigan? [Trazabilidad, Spec §Aclaraciones, Supuestos]

## Resolución de la revisión (2026-11-03)

Los 43 puntos se revisaron contra la especificación y el código. A petición del responsable del proyecto, la revisión y las marcas las hizo el agente con la mejor decisión disponible; el responsable las aprueba al aceptar el commit. Los huecos se corrigieron en `spec.md`:

- CHK001, CHK031: momento del precio guardado y concurrencia con otras ediciones o con la desactivación (FR-010).
- CHK002, CHK003, CHK036: límite inclusivo del total, aplicado a refacciones, servicios y mano de obra; cantidad de 1 a 1,000,000 (FR-003, casos límite).
- CHK004, CHK005: forma de la confirmación y cuándo no se pide (FR-004).
- CHK006: orden Cancelada (FR-012-b, casos límite).
- CHK007, CHK017, CHK018, CHK020: alcance del ocultamiento al mecánico, comportamiento de su interfaz y su acceso a pagos y tickets (FR-008).
- CHK008: riesgo de deducir el total, aceptado y documentado (Supuestos).
- CHK009, CHK010, CHK038: quién cambia precios, categoría y marca, y la exclusión del historial de precios y de la auditoría (FR-001, Supuestos).
- CHK011, CHK035: refacción desactivada y línea con importe 0 (casos límite).
- CHK012, CHK013: glosario y definición de saldo disponible (Supuestos, FR-015).
- CHK014, CHK015, CHK016, CHK025, CHK028, CHK030: términos vagos cuantificados (FR-019, SC-001, SC-002, SC-004, SC-005, SC-006).
- CHK019: FR-016 reescrito para no contradecir los estados cobrables.
- CHK026, CHK027: el redondeo solo aplica a la mano de obra; regla definida (historia 4, SC-003, Supuestos).
- CHK029, CHK037, CHK039: cobertura de los requisitos nuevos y de las rutas (FR-022, SC-002, SC-006).
- CHK032: atomicidad al agregar, cambiar o quitar una refacción (FR-024).
- CHK034, CHK041: totales de ejemplo coincidentes (7 de 7 órdenes) y precios obligatorios, verificados (Supuestos).
- CHK040, CHK042, CHK043: migración aditiva, proveedor simulado de Mercado Pago y decisiones D-01 a D-07 con una sola fuente de verdad, ya reflejada en el insumo.
- Sin cambios (ya cumplían): CHK021, CHK022, CHK023, CHK024, CHK033.

## Notas

- Marca los puntos con `[x]` solo cuando la revisión confirme que el criterio de calidad se cumple.
- Deja sin marcar los puntos que aún requieran aclaración, corrección o evaluación del revisor.
- `/speckit-implement` lee el estado de las marcas como una puerta y no las modifica.
- `checklists/requirements.md` tiene su propio ciclo, que mantienen `/speckit-specify` y `/speckit-clarify`.
- Cada punto que revele un hueco se resuelve cambiando la especificación y se registra como hallazgo en el documento de aseguramiento de la calidad.
