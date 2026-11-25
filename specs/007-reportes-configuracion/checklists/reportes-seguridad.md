# Lista de calidad de requisitos: Reportes, términos y seguridad

**Propósito**: Revisar la calidad de los requisitos del Sprint 7 (reportes, términos y condiciones, bitácora, inactividad y no exposición de datos) antes de planear. Es una prueba unitaria de los requisitos, no de la implementación.

**Creado**: 2026-11-25 · **Profundidad**: estándar · **Audiencia**: quien implementa · **Funcionalidad**: [spec.md](../spec.md)

## Cálculo de los reportes

- [x] CHK001 ¿Está definida la fecha que decide si una orden entra en un reporte? [Claridad, Spec FR-010, FR-011] — Corregido: la fecha en que quedó Terminada, según el historial de estados.
- [x] CHK002 ¿Está definido qué pagos cuentan en los ingresos y por qué fecha? [Claridad, Spec FR-009] — Pagados, por fecha de cobro dentro del rango.
- [x] CHK003 ¿Se define cómo se agrupa el periodo y el valor predeterminado? [Completitud, Spec FR-009] — Corregido: por día o por mes, por día de forma predeterminada.
- [x] CHK004 ¿Está definido el límite del rango y qué pasa con rangos inválidos? [Completitud, Spec FR-014]
- [x] CHK005 ¿Se define el cálculo del margen cuando no hay precio de compra y de qué costo se parte? [Completitud, Spec FR-012, Supuestos]
- [x] CHK006 ¿Se define la rotación y su caso de existencia cero? [Claridad, Spec FR-013]
- [x] CHK007 ¿Se aclara qué ocurre con una orden Terminada y luego Entregada (no contarla dos veces)? [Caso límite] — Corregido: se añadió el caso límite.
- [x] CHK008 ¿Se exige que dos agrupaciones del mismo rango sumen lo mismo? [Medibilidad, Spec casos límite] — Corregido: se añadió el caso límite.
- [x] CHK009 ¿Los importes tienen una regla de precisión? [Claridad, Spec FR-015] — Centavos enteros.

## Exportación

- [x] CHK010 ¿Están definidos el formato, la codificación y la duración del enlace? [Claridad, Spec FR-016]
- [x] CHK011 ¿Se define la protección contra fórmulas en las celdas? [Cobertura de seguridad, Spec FR-016]
- [x] CHK012 ¿Se exige que el archivo coincida con la pantalla de forma medible? [Medibilidad, Spec SC-004]

## Términos y condiciones

- [x] CHK013 ¿Están definidas las rutas exentas de la aceptación? [Completitud, Spec FR-021] — Corregido: se añadió consultar la propia sesión; el cierre de sesión es del cliente.
- [x] CHK014 ¿Se define qué pasa si no hay versión publicada? [Caso límite, Spec FR-021, escenario 6 de US9]
- [x] CHK015 ¿Se define qué pasa con una sesión abierta cuando se publica una versión nueva? [Caso límite, Spec casos límite]
- [x] CHK016 ¿Se define la numeración de versiones ante publicaciones simultáneas? [Caso límite, Spec casos límite]
- [x] CHK017 ¿Se aclara que el texto es una plantilla sin valor de asesoría legal? [Supuesto, Spec FR-023, Supuestos]

## Bitácora

- [x] CHK018 ¿Está cerrada la lista de acciones que se registran? [Completitud, Spec FR-024]
- [x] CHK019 ¿Se define qué se guarda de un inicio de sesión fallido (y qué nunca)? [Claridad, Spec FR-024] — Corregido: el identificador escrito, nunca la contraseña.
- [x] CHK020 ¿Se exige la inmutabilidad y la ausencia de exportación? [Completitud, Spec FR-025]
- [x] CHK021 ¿Se define la lista cerrada de campos para impedir secretos? [Medibilidad, Spec FR-026, SC-005]

## Inactividad y seguridad

- [x] CHK022 ¿Se define qué cuenta como actividad? [Ambigüedad, Spec FR-028] — Corregido: la consulta automática de avisos no cuenta; si no, la sesión nunca expiraría.
- [x] CHK023 ¿El límite de 30 minutos es medible en sus extremos? [Medibilidad, Spec casos límite] — Exactamente 30 vigente, más de 30 rechazada.
- [x] CHK024 ¿Los encabezados de seguridad se enumeran de forma comprobable? [Claridad, Spec FR-029]
- [x] CHK025 ¿La no exposición de datos se verifica por endpoint y por rol? [Cobertura, Spec FR-030]
- [x] CHK026 ¿La prueba de inyección define dónde se aplica? [Cobertura, Spec FR-031] — Campos de búsqueda de los listados.

## Permisos y configuración

- [x] CHK027 ¿Se define qué roles leen el catálogo de tipos de servicio y cuáles lo modifican? [Completitud, Spec FR-006]
- [x] CHK028 ¿Se definen límites numéricos de los márgenes y los intervalos? [Claridad, Spec FR-003, FR-005]
- [x] CHK029 ¿Se define el respaldo cuando no hay configuración guardada? [Completitud, Spec FR-004]
- [x] CHK030 ¿Se define qué ve cada rol de los tickets anteriores al sprint? [Caso límite, Spec FR-002]

## Resultado

30 puntos revisados contra `spec.md`: 7 huecos corregidos (CHK001, CHK003, CHK007, CHK008, CHK013, CHK019 y CHK022) y los demás ya estaban cubiertos. Ninguna pregunta de aclaración quedó abierta.
