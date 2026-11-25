# Propuesta de sprints posteriores al MVP

> **Estado:** actualizada el 2026-11-24. El Sprint 5 ya está implementado; los Sprints 6 y 7 tienen su insumo redactado como borrador y se construyen con Spec Kit del 24 al 29 de noviembre. El Sprint 7 es el último del proyecto.
> **Base:** `docs/project-context.md` (alcance y sección 27 "Decisiones pendientes").

## Cómo leer este documento

Cada sprint está marcado según su origen: **Deuda** (el contexto maestro lo dejó pendiente) o **Propuesta** (idea nueva). Lo señalado como "Verificado" se comprobó en el código.

## Descartado

- **Chatbot de WhatsApp y mensajería al cliente:** fuera del alcance del proyecto. No se implementa ni se envía o recibe ningún mensaje automático (WhatsApp, correo o SMS); ningún sprint lo incluye ni lo prepara.
- **Fotos del vehículo, hosting, respaldos y puesta en producción (antes Sprint 8):** descartados del alcance el 2026-11-19.
- **Portal del cliente:** contradice el contexto. El cliente es un beneficiario externo y no es un usuario autenticado.
- **Facturación electrónica:** no aparece en el contexto maestro.

## Resumen y estado

| Sprint | Tema | Origen | Insumo | Estado |
|---|---|---|---|---|
| 5 | Precios de refacciones y cobro completo | Deuda | `sprint-5-precios-refacciones-cobro.md` | Implementado |
| 6 | Notificaciones internas | Deuda | `sprint-6-notificaciones-internas.md` | Por especificar |
| 7 | Reportes, configuración, términos y seguridad | Deuda y propuesta | `sprint-7-reportes-configuracion.md` | Por especificar |

## Alcance de cada sprint

- **Sprint 5 (implementado):** categoría, marca y precios de las refacciones; el total de la orden suma las refacciones y el pago y el ticket reflejan el nuevo total; los pagos y tickets ya emitidos conservan su importe.
- **Sprint 6:** centro de notificaciones en el encabezado (mantenimientos próximos y vencidos, citas del día, stock bajo y órdenes detenidas), calculado con datos reales; solo se guarda el estado "leída". Incluye la lista de **clientes por avisar** para que recepción llame o avise y lo marque como avisado. *Verificado:* hoy existe solo el resumen de stock de Inventario y los contadores del dashboard (este último solo para ADMIN).
- **Sprint 7:** términos y condiciones al ingresar, seguridad de la información (bitácora, política de contraseñas y cierre por inactividad), reportes para el administrador (ingresos por periodo, servicios frecuentes, productividad por mecánico y rotación de inventario, con exportación), configuración del taller (datos del ticket y márgenes de "Próximo"), el ticket con la fecha del próximo servicio, catálogo de tipos de servicio con intervalos configurables y costeo de refacciones. *Verificado:* no existe módulo de reportes ni de configuración; los datos del taller viven en `.env`. Si el tiempo no alcanza, se divide: configuración y catálogo primero, reportes después.

## Orden recomendado

```text
5 → 6 → 7
```

- El 6 y el 7 se pueden intercambiar; se recomienda el 6 primero porque es más corto y reutiliza cálculos existentes.

## Decisiones recomendadas

Son recomendaciones del equipo de desarrollo; el equipo del proyecto las confirma o corrige.

1. **Sprint 7:** dividir en dos entregas si el tiempo es corto: configuración, términos y seguridad primero, reportes después.

## Preguntas que siguen abiertas

- Confirmar las decisiones recomendadas anteriores.
