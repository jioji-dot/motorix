# Plan de implementación: Precios de refacciones y cobro completo

**Rama**: `005-precios-refacciones-cobro` | **Fecha**: 2026-11-03 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/005-precios-refacciones-cobro/spec.md`

## Resumen

Los Sprints 3 y 4 ya construyeron los precios de las refacciones, el precio guardado en cada línea de la orden, el total con refacciones, el cobro y el ticket (hallazgo H-02). Este plan **no reconstruye nada de eso**: agrega lo que la especificación marca como «agrega» y protege con pruebas lo que marca como «mantiene». Los cambios de código son cuatro y todos se apoyan en piezas existentes:

1. **Ocultar precios al mecánico (FR-008)**: ampliar los serializadores por rol (`services/serializers.js`) para que el mecánico no reciba ningún precio ni importe de refacciones ni el total de la orden, y adaptar las pantallas para que no muestren esos datos. Es el cambio de contrato del hallazgo H-07.
2. **Límite de importes (FR-003)**: validar, antes de guardar, que el importe de la línea y el total de la orden no superen 99,999,999.99, en cualquier cambio que aumente el total.
3. **Venta menor al costo (FR-004)**: rechazar el guardado de una refacción con venta menor a la compra salvo confirmación explícita, en el servidor y en el formulario.
4. **Atomicidad y pruebas (FR-024, FR-022)**: demostrar con pruebas que agregar, cambiar o quitar una refacción es todo o nada, y cubrir con pruebas nuevas el precio guardado, el total, el redondeo de la mano de obra, la visibilidad por rol, la concurrencia del pago y la compatibilidad con pagos y tickets anteriores.

**No se crea la migración 005 ni seeds nuevos**: ningún cambio exige columnas nuevas (los límites y la confirmación viven en el servicio) y los datos de ejemplo ya incluyen una orden Terminada cobrable con refacciones (OS-000005, con un pago parcial) y una Entregada pagada (OS-000006). Las decisiones técnicas están en [research.md](research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js 24 con JavaScript ES Modules; Dart con Flutter 3.47.5 (igual que los sprints anteriores)

**Dependencias principales**: ninguna nueva, ni en el backend ni en el frontend

**Almacenamiento**: MySQL 8.0 local, InnoDB, `utf8mb4`; sin cambios de esquema (ver [data-model.md](data-model.md))

**Pruebas**: Jest (unitarias de los serializadores, los límites y la regla de venta menor al costo) y Jest + supertest (integración y contrato, con concurrencia) contra la base `*_test`; `flutter test` en el frontend. Las pruebas van antes del código en cada historia

**Plataforma objetivo**: Aplicación Flutter de escritorio/web con prioridad en escritorio; API REST local

**Tipo de proyecto**: Aplicación web con frontend y backend separados (`client/` y `server/`)

**Metas de rendimiento**: sin cambios respecto al Sprint 4; las validaciones nuevas son aritmética en memoria dentro de la transacción que ya existe

**Restricciones**: el servidor nunca entrega precio de compra a recepción ni al mecánico, ni precios, importes o total al mecánico; el importe de una línea y el total nunca superan 99,999,999.99; una línea conserva el precio con que se agregó; permisos validados en el backend; toda pantalla sigue `docs/design-system.md`; sin secretos en el repositorio

**Escala/Alcance**: un taller; 0 tablas nuevas; alrededor de 6 archivos de servicio y modelo del backend y 6 pantallas o widgets del frontend

## Verificación de la constitución

*PUERTA: debe aprobarse antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Cumplimiento | Evidencia en el plan |
|-----------|--------------|----------------------|
| I. Alcance, MVP y fuente de verdad | Cumple | Es el primer sprint posterior al MVP, aprobado en la enmienda 1.1.0 (2026-11-03); no agrega funciones fuera del insumo; `docs/project-context.md` se actualiza (FR-023) |
| II. Arquitectura con responsabilidades separadas | Cumple | Reglas en `services/`; proyección por rol en `services/serializers.js`; límites en un módulo puro del servicio; Mercado Pago no se toca |
| III. Stack y base de datos local | Cumple | Sin tecnologías nuevas; **sin migración nueva** (ninguna columna hace falta); los seeds actuales bastan y se verifican; si el diseño cambiara y hiciera falta una migración, sería aditiva y numerada |
| IV. Seguridad | Cumple | El ocultamiento de precios se valida en el backend; el mecánico no recibe esos datos aunque llame directo a la API; sin datos de tarjeta ni secretos; errores sin trazas |
| V. Integridad de las reglas de negocio | Cumple | El precio queda guardado en la línea; el movimiento de inventario, la línea y el total cambian juntos; una orden Terminada o Entregada no cambia su total |
| VI. API consistente y manejo de errores | Cumple | Dos códigos nuevos (`PRICE_BELOW_COST` y `AMOUNT_LIMIT_EXCEEDED`) con el formato de error existente; contrato en [contracts/api.md](contracts/api.md) |
| VII. Pruebas | Cumple | Pruebas antes del código en cada historia, contra `motorix_test`; la regresión de los Sprints 1 a 4 se mide con una línea base (1240 pruebas de backend y 242 de frontend) |
| VIII. UX/UI profesional y sencilla | Cumple | Las pantallas solo ocultan campos y agregan un diálogo de confirmación con los componentes y tokens existentes; sin dependencias nuevas |

**Resultado de la puerta**: sin violaciones; no se requiere seguimiento de complejidad.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/005-precios-refacciones-cobro/
├── spec.md
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── api.md           # Fase 1: proyecciones por rol y errores nuevos
├── checklists/
│   ├── requirements.md
│   └── cobro.md
└── tasks.md             # Fase 2 (lo crea /speckit.tasks)
```

### Código fuente (raíz del repositorio)

```text
server/
├── services/
│   ├── serializers.js          # se amplía: orden, listado, historial y refacción por rol (FR-008)
│   ├── orderLimits.js          # nuevo: límite de importes en centavos, función pura (FR-003)
│   ├── orderService.js         # aplica el serializador y el límite en los cambios de líneas
│   ├── orderPartService.js     # aplica el límite al agregar o cambiar la cantidad
│   ├── partService.js          # confirma la venta menor al costo (FR-004)
│   └── vehicleHistoryService.js# aplica el serializador del historial
├── validators/
│   └── partValidator.js        # campo opcional de confirmación en el alta y la edición
└── tests/                      # pruebas nuevas y ajustadas (ver la lista en research.md, punto 8)

client/lib/
├── models/                     # precios y total pasan a ser opcionales
├── screens/                    # órdenes, detalle de orden, refacciones, detalle y formulario de refacción, historial
└── widgets/                    # selector de refacción de la orden

docs/                           # project-context.md y design-system.md se actualizan (FR-023)
```

**Decisión de estructura**: se conserva la estructura de los sprints anteriores. No hay carpetas nuevas en el código; solo un módulo puro nuevo (`orderLimits.js`) para que el límite se pruebe sin base de datos.

## Seguimiento de complejidad

Sin violaciones de la constitución que justificar.
