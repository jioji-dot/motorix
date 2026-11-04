<!--
Insumo de especificación para /speckit.specify.
Sprint 5 post-MVP de Motorix: precios de refacciones y cobro completo.
Reformulado el 2026-11-03 tras revisar el código (hallazgo H-02 del aseguramiento de la calidad): el MVP ya implementa
los precios y el total con refacciones, así que este sprint endurece, completa y demuestra ese comportamiento.
Borrador para revisión: las decisiones de la sección 9 no están resueltas.
-->

# Insumo de especificación - Sprint 5: Precios de refacciones y cobro completo

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitución: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe únicamente el alcance del Sprint 5.

## 1. Contexto del sprint

Es el primer sprint posterior al MVP. Al revisar el código se comprobó que los Sprints 3 y 4 ya dejaron construido gran parte del cobro con refacciones:

- `parts` ya tiene `category`, `brand`, `purchasePrice` y `salePrice` (migración 003), con validación de importes de dos decimales, mínimo 0 y máximo 99,999,999.99.
- `order_parts` ya guarda `unitPrice` (el precio de venta vigente al agregar la línea) y `amount` (cantidad por precio, calculado por la base).
- El total de la orden ya es servicios más mano de obra más refacciones (`recalculateTotal`).
- El pago ya se valida contra el total de la orden (saldo disponible, parciales y cobros simultáneos) y el ticket ya incluye las refacciones con precio e importe.
- El precio de compra ya solo lo recibe el administrador.

Lo que falta es cerrar los huecos que ese trabajo dejó y demostrarlos con pruebas: quién ve el precio de venta, los límites y las reglas de los precios, la garantía de que un cambio de precio no altera lo ya emitido, y la documentación. El sprint toca el cálculo del dinero, la zona de mayor riesgo del sistema.

## 2. Objetivo

Que el precio de las refacciones y el cobro de la orden sean confiables y estén demostrados: precios con reglas y límites claros, visibilidad de precios por rol validada en el backend, y la garantía probada de que un cambio de precio no altera órdenes, pagos ni tickets ya emitidos.

## 3. Historias de usuario del sprint

- **US1** - Como administrador, quiero que los precios de compra y de venta de una refacción tengan reglas y límites claros para evitar errores de captura que dañen el cobro.
- **US2** - Como mecánico, quiero seguir usando las refacciones en una orden sin ver precios para no exponer información financiera del taller.
- **US3** - Como administrador, quiero que un cambio de precio no altere órdenes abiertas ni pagos y tickets ya emitidos para conservar la integridad del historial.
- **US4** - Como recepcionista, quiero que el total, el pago y el ticket de la orden coincidan siempre, con refacciones, para entregar un comprobante correcto al cliente.
- **US5** - Como administrador, quiero datos de ejemplo y documentación al día para demostrar y mantener el cobro con refacciones.

## 4. Flujo demostrable al cierre del sprint

    Administrador registra una refacción con categoría, marca, precio de compra y precio de venta (con reglas y límites)
    -> mecánico agrega la refacción a una orden sin ver ningún precio
    -> la orden pasa a Terminada
    -> recepción consulta el total (servicios + mano de obra + refacciones)
    -> registra el pago por ese total
    -> se genera el ticket con las refacciones, su importe y el total
    -> el administrador cambia el precio de la refacción
    -> la orden, el pago y el ticket ya emitidos conservan su importe

## 5. Entidades y tablas que toca este sprint

> Basado en las secciones 6.7, 6.8, 6.10 y 14.1 de `project-context.md`.

| Entidad / tabla | Acción en este sprint |
|-----------------|-----------------------|
| `parts` | consultar y validar precios con las reglas y límites nuevos; sin columnas nuevas previstas |
| `order_parts` | consultar el precio guardado; probar que no cambia; sin cambio de estructura previsto |
| `payments` | probar el importe contra el total con refacciones; sin cambio de estructura |
| `tickets` | probar que el contenido emitido no cambia al cambiar precios; revisar cómo se arma el contenido |
| servicios y mano de obra de la orden | consultar para el total |
| migración `005_...sql` | solo si una decisión de la sección 9 lo exige (por ejemplo, restricciones nuevas); aditiva |
| seeds del sprint | verificar y completar, sin duplicar |

## 6. Reglas de negocio aplicables

- RN-6: Las refacciones utilizadas deben estar relacionadas con una orden.
- RN-7: El uso de una refacción debe generar o reflejar una salida de inventario.
- RN-8: No permitir stock negativo.
- RN-9: Una orden entregada debe conservarse como historial.
- RN-13: Todo pago debe estar relacionado con una orden.
- RN-14: Los datos sensibles del procesamiento de pagos no deben almacenarse en la aplicación.
- RN-15: Los permisos deben validarse en backend.

## 7. Criterios de aceptación

- [ ] CA-1: Los precios de compra y de venta rechazan valores negativos, no numéricos y con más de dos decimales; se definen y prueban los límites máximos del precio, de la línea (cantidad por precio) y del total para que quepan en `DECIMAL(10,2)` con un mensaje claro.
- [ ] CA-2: Un precio de venta menor al de compra se trata según la decisión D-02 y queda probado.
- [ ] CA-3: Al agregar una refacción a una orden se guarda su precio de venta vigente; un cambio posterior del precio no modifica esa línea, su importe ni el total, incluso con solicitudes simultáneas.
- [ ] CA-4: El total de la orden es servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros, con pruebas de redondeo y de valores límite.
- [ ] CA-5: El pago se registra contra el total con refacciones: no puede exceder el saldo, los cobros simultáneos nunca superan el total y Mercado Pago recibe el importe correcto.
- [ ] CA-6: Los pagos y los tickets ya emitidos conservan su importe y su contenido al cambiar los precios de las refacciones; se comprueba con los datos de ejemplo y con pruebas.
- [ ] CA-7: El ticket incluye cantidad, precio unitario e importe de cada refacción, y su subtotal coincide con el total de la orden.
- [ ] CA-8: El mecánico no recibe precio de venta, precio de compra ni importes de refacciones en ninguna consulta (inventario, alertas, detalle de la orden, historial del vehículo), según la decisión D-01, validado en backend.
- [ ] CA-9: Recepción recibe el precio de venta pero nunca el de compra en ninguna consulta; solo el administrador recibe el de compra.
- [ ] CA-10: El panel de control y los listados de órdenes y pagos funcionan con el nuevo total.
- [ ] CA-11: Los seeds incluyen refacciones con precios y una orden Terminada cobrable con refacciones, y son idempotentes.
- [ ] CA-12: Se mantienen las reglas del Sprint 4: ningún dato de tarjeta almacenado y los permisos validados en backend.
- [ ] CA-13: `docs/project-context.md`, `docs/design-system.md` y los comentarios del código que describan el cobro de refacciones se actualizan en el mismo sprint.

## 8. Fuera de alcance de este sprint

- Costeo, margen de ganancia, utilidad y reportes financieros (Sprint 7).
- Impuestos y facturación electrónica.
- Descuentos, promociones y pagos a plazos.
- Reembolsos dentro del sistema.
- Catálogo de proveedores y órdenes de compra.
- Notificaciones, reportes, configuración del taller y WhatsApp (Sprints 6 a 9).
- Fotos del vehículo y puesta en producción (Sprint 10).

Los pagos parciales ya existen desde el Sprint 4 y no se tocan.

## 9. Decisiones que se resolvieron en /speckit.clarify

> Resueltas el 2026-11-03. La resolución vigente está en `specs/005-precios-refacciones-cobro/spec.md` (sección «Aclaraciones» y «Supuestos»): D-01 el mecánico no ve ningún precio ni el total; D-02 venta menor al costo con confirmación; D-03 precio 0 permitido; D-04 máximo 99,999,999.99; D-05 sin corrección manual del precio de una línea; D-06 y D-07 respaldadas por el código y el Sprint 4. El texto de abajo conserva las preguntas originales.

- **D-01**: Visibilidad del precio de venta para el mecánico. Hoy lo recibe en el inventario y en las líneas de la orden. ¿Se le oculta por completo (con el total de la orden incluido) o solo el de compra?
- **D-02**: Precio de venta menor al de compra: ¿se permite, se advierte o se rechaza?
- **D-03**: Precio de venta 0: hoy se acepta. ¿Se permite, o se exige un precio mayor que 0?
- **D-04**: Límites máximos del precio, del importe de una línea y del total de la orden, y el mensaje cuando se excedan.
- **D-05**: Si el administrador corrige el precio de una línea de una orden abierta: hoy solo se puede cambiar la cantidad. ¿Se agrega esa corrección y con qué permiso y motivo, o queda fuera?
- **D-06**: Hoy las líneas solo se editan con la orden en curso y solo se cobra en Terminada o Entregada. ¿Una orden Terminada puede volver a un estado en curso? Si puede, ¿qué ocurre con un pago o un ticket ya emitidos y con un pago pendiente de Mercado Pago?
- **D-07**: El ticket se arma en cada consulta a partir de las líneas actuales y no guarda su contenido. ¿Se mantiene así o se congela el contenido al emitirlo?

## 10. Restricciones técnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: español en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foráneas, `utf8mb4`.
- Login acepta usuario o correo electrónico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integración contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicación muestre información al arrancar. La base no puede quedar vacía tras la instalación.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.
- Los importes se calculan en centavos enteros y se guardan como `DECIMAL(10,2)`, igual que en el Sprint 4.
- Las migraciones son aditivas y numeradas (`005_...sql`); no modifican las migraciones anteriores.
