# Lista de calidad de requisitos de notificaciones y clientes por avisar: Notificaciones internas y clientes por avisar

**Propósito**: Revisar la calidad de los requisitos de la especificación (completitud, claridad, consistencia, medibilidad y cobertura) sobre los avisos del centro de notificaciones, los permisos por rol, la coincidencia de cifras con el panel de control, Mantenimientos e Inventario, la identidad y la lectura de los avisos, los hechos de la lista de clientes por avisar, el rendimiento de la consulta y los estados de la interfaz.

**Creado**: 2026-11-24

**Funcionalidad**: [spec.md](../spec.md)

**Profundidad**: estándar (revisión previa a planear). **Audiencia**: quien implementa, con el responsable del proyecto como revisor.

**Nota**: Esta lista la genera el comando `/speckit-checklist` a partir de la especificación del sprint.

**Responsable de la revisión**: esta lista es un artefacto de revisión de la calidad de los requisitos. Marca un punto con `[x]` solo cuando el revisor determine que el criterio de calidad se cumple.

**Significado de las marcas**: `[x]` significa que el criterio se revisó y se cumple en los requisitos. No significa que la implementación esté hecha.

## Completitud de los requisitos

- [x] CHK001 ¿Se define qué datos muestra cada tipo de aviso (mantenimiento, cita, stock y orden detenida)? [Laguna, Spec §FR-002]
- [x] CHK002 ¿Se define el orden de los avisos dentro de cada tipo y qué significa «los más urgentes» cuando hay muchos? [Laguna, Spec §FR-002, Casos límite]
- [x] CHK003 ¿Se define qué muestra la campana cuando hay muchos avisos no leídos? [Laguna, Spec §FR-001]
- [x] CHK004 ¿Se define qué órdenes detenidas recibe recepción (todas o solo algunas)? [Ambigüedad, Spec §FR-006]
- [x] CHK005 ¿Se define qué ocurre con una orden que no tiene registros en el historial de estados? [Laguna, Spec §FR-005]
- [x] CHK006 ¿Se define qué ocurre cuando falla la consulta periódica en segundo plano? [Cobertura, Spec §FR-011]
- [x] CHK007 ¿Se define si el teléfono del cliente aparece en los avisos del panel o solo en la lista de clientes por avisar? [Laguna, Spec §FR-002, FR-015]
- [x] CHK008 ¿Se define el orden de la lista de clientes por avisar? [Laguna, Spec §FR-015]

## Claridad de los requisitos

- [x] CHK009 ¿«3 o más días» de la orden detenida está definido como días de calendario o como horas? [Ambigüedad, Spec §FR-005]
- [x] CHK010 ¿«Hoy» y «mañana» están definidos con una zona horaria única? [Claridad, Spec §Supuestos]
- [x] CHK011 ¿Está definido qué es el «estado» que distingue un aviso para la reaparición, en cada tipo de aviso? [Ambigüedad, Spec §FR-009]
- [x] CHK012 ¿Se usa un único término para aviso, lectura, hecho y aviso a cliente? [Terminología, Spec §Entidades clave, Supuestos]
- [x] CHK013 ¿Está cuantificado el rendimiento con un volumen y un entorno de medición? [Medibilidad, Spec §SC-003]

## Consistencia de los requisitos

- [x] CHK014 ¿Son consistentes FR-006 y FR-012 en que el stock solo lo recibe el administrador? [Consistencia, Spec §FR-006, FR-012]
- [x] CHK015 ¿Son consistentes la reaparición de un aviso (FR-009) y el hecho nuevo de un cliente (FR-017) cuando el estado cambia? [Consistencia, Spec §FR-009, FR-017]
- [x] CHK016 ¿Coinciden las reglas de la cita del día entre FR-004, la historia 2 y el caso límite de la hora pasada? [Consistencia, Spec §FR-004]
- [x] CHK017 ¿Los márgenes de mantenimiento citados (15 días y 500 km) coinciden con los vigentes en el sistema y no con los del insumo original? [Conflicto, Spec §FR-004]
- [x] CHK018 ¿La exclusión de la mensajería al cliente (FR-018) es consistente con la constitución 1.2.0 y la propuesta de sprints? [Consistencia, Spec §FR-018]

## Calidad de los criterios de aceptación

- [x] CHK019 ¿Cada criterio de éxito SC-001 a SC-007 tiene un procedimiento de medición observable? [Medibilidad, Spec §Criterios de éxito]
- [x] CHK020 ¿Cada requisito funcional queda cubierto por un escenario, un caso límite o un criterio de éxito? [Trazabilidad, Spec §Requisitos]
- [x] CHK021 ¿Indica SC-002 con qué pantallas se comparan las cifras del centro? [Claridad, Spec §SC-002]
- [x] CHK022 ¿Hay un criterio medible para la restricción del mecánico ante peticiones directas al servidor? [Cobertura, Spec §SC-001]

## Cobertura de escenarios

- [x] CHK023 ¿Se define qué pasa al marcar como leído un aviso que ya desapareció o que no es visible para el rol? [Laguna, Spec §FR-008]
- [x] CHK024 ¿Se define qué pasa al marcar como avisado un hecho que ya dejó de aplicar? [Laguna, Spec §FR-017, Casos límite]
- [x] CHK025 ¿Se define el comportamiento con dos sesiones abiertas del mismo usuario? [Cobertura, Spec §FR-011]
- [x] CHK026 ¿Se cubre el cambio de rol o la reasignación de una orden mientras existen avisos? [Cobertura, Spec §Historia 5, Casos límite]
- [x] CHK027 ¿Queda claro dónde se decide la recuperación ante un fallo al aplicar la migración? [Recuperación, Spec §FR-020]

## Cobertura de casos límite

- [x] CHK028 ¿Se cubren las fronteras de fecha y kilometraje (medianoche, 15 días, 500 km)? [Casos límite, Spec §Casos límite]
- [x] CHK029 ¿Se cubren los registros desactivados (cliente y refacción)? [Casos límite, Spec §Casos límite, Supuestos]
- [x] CHK030 ¿Se define el tope de avisos por tipo y que el conteo total no se pierde? [Casos límite, Spec §Supuestos, Casos límite]

## Requisitos no funcionales

- [x] CHK031 ¿Se definen los requisitos de accesibilidad de la campana y del panel (teclado, descripción emergente y cierre con Escape)? [No funcional, Spec §FR-014]
- [x] CHK032 ¿Se define qué datos personales viajan en cada respuesta según el rol (teléfono solo en la lista de clientes por avisar)? [Privacidad, Spec §FR-002, FR-015]
- [x] CHK033 ¿Se exige que todos los textos de la interfaz estén en español? [No funcional, Spec §FR-014]
- [x] CHK034 ¿Está acotada la carga de la consulta periódica sobre el servidor? [No funcional, Spec §SC-003]

## Dependencias y supuestos

- [x] CHK035 ¿Se documenta la dependencia del historial de estados y de los datos de los Sprints 2 a 4? [Dependencia, Spec §Supuestos]
- [x] CHK036 ¿Se garantiza que existan datos de ejemplo suficientes para demostrar cada aviso? [Supuesto, Spec §FR-021, SC-007]
- [x] CHK037 ¿La migración está numerada de forma consecutiva con la última existente? [Dependencia, Spec §FR-020]
- [x] CHK038 ¿Se declara si los valores de este sprint (72 horas, 60 segundos, 10 avisos por tipo) son fijos o configurables? [Supuesto, Spec §Supuestos]

## Ambigüedades y conflictos

- [x] CHK039 ¿Quedan marcadores [NEEDS CLARIFICATION] pendientes en la especificación? [Ambigüedad]
- [x] CHK040 ¿La sección 9 del insumo sigue presentando como pendientes decisiones que ya se resolvieron? [Conflicto, insumo §9]

## Resoluciones de la revisión

Cada punto que reveló un hueco se corrigió en `spec.md` y se registró como hallazgo H-06 en el documento de aseguramiento de la calidad.

- CHK001, CHK002, CHK007: contenido mínimo de cada tipo de aviso, orden por urgencia y avisos del panel sin teléfonos (FR-002).
- CHK003: la campana muestra «99+» cuando pasa de 99 (FR-001).
- CHK004: recepción recibe las órdenes detenidas de todas las órdenes (FR-006).
- CHK005, CHK009: una orden detenida se mide en 72 horas desde el último cambio de estado y, sin historial, desde su fecha de creación (FR-005).
- CHK006, CHK025: los fallos de la consulta periódica no interrumpen al usuario y la lectura de otra sesión se refleja en la siguiente actualización (FR-011).
- CHK008: la lista de clientes por avisar se ordena por la fecha del hecho, la más antigua primero (FR-015).
- CHK011: el estado que distingue un aviso es la clasificación (mantenimientos) o el nivel (stock); las citas y las órdenes no tienen estado adicional (FR-009).
- CHK012: glosario de aviso, lectura, hecho y aviso a cliente (Supuestos).
- CHK013: SC-003 indica que se mide en el equipo de desarrollo del proyecto.
- CHK023: solo se guardan lecturas de avisos que existen y son visibles para el usuario; marcar uno que ya desapareció no falla (FR-008).
- CHK024: marcar avisado un hecho que ya no aplica se rechaza con un mensaje claro y la lista se actualiza (FR-017 y Casos límite).
- CHK031, CHK033: accesibilidad de la campana y textos en español (FR-014).
- CHK038: los valores de este sprint son fijos (Supuestos).
- CHK040: se actualizó la sección 9 del insumo para indicar que sus decisiones ya se resolvieron.
- Sin cambios (ya cumplían): CHK010, CHK014 a CHK022, CHK026 a CHK030, CHK035 a CHK037, CHK039. CHK027 y CHK034 se resuelven en el plan (aplicación de la migración sobre la base de pruebas primero y medición del rendimiento).

## Notas

- Marca los puntos con `[x]` solo cuando la revisión confirme que el criterio de calidad se cumple.
- Deja sin marcar los puntos que aún requieran aclaración, corrección o evaluación del revisor.
- `/speckit-implement` lee el estado de las marcas como una puerta y no las modifica.
- `checklists/requirements.md` tiene su propio ciclo, que mantienen `/speckit-specify` y `/speckit-clarify`.
- Cada punto que revele un hueco se resuelve cambiando la especificación y se registra como hallazgo en el documento de aseguramiento de la calidad.
