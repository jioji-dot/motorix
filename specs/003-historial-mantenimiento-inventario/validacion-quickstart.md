# Validación del quickstart: Sprint 3

**Fecha**: 2026-10-19 | **Base**: `motorix_sdd` (datos de ejemplo cargados con `npm run seed`) | **API**: `http://localhost:3000/api`

Se ejecutaron los 22 escenarios de [`quickstart.md`](quickstart.md) contra la API real con un script que usa las cuentas
iniciales y deja la base como estaba (los datos temporales llevan el prefijo `QS3` y se eliminaron al terminar; la
comprobación final no encontró restos).

## Preparación de la base de datos

| Paso | Resultado |
|------|-----------|
| Aplicar la migración 003 en `motorix_sdd` y `motorix_sdd_test` | Se aplicó la 003 y la 001 y la 002 aparecieron como "Ya aplicada" |
| Repetir `aplicar-migraciones.ps1` | La 003 no se volvió a ejecutar ("0 migración(es) nueva(s)") |
| `npm run seed` y repetirlo | Sin errores y sin duplicados: 14 refacciones, 21 movimientos, 5 líneas de refacciones en órdenes y 7 mantenimientos |
| Invariante `stock = suma de movimientos` | 0 refacciones con diferencia |
| Niveles de stock de los datos de ejemplo | 11 en orden, 2 con stock bajo, 1 agotada |

## Resultados por escenario

| # | Escenario | Resultado | Evidencia |
|---|-----------|-----------|-----------|
| 1 | Historial del vehículo | CORRECTO | Solo 2 entradas (terminada y entregada), la más reciente primero; la orden en curso y la cancelada no aparecen |
| 2 | Kilometraje del servicio | CORRECTO | Menor al de entrada: 400 (campo `serviceMileage`); válido: 200; el kilometraje del vehículo subió a 40450 |
| 3 | Programar mantenimiento | CORRECTO | HTTP 201, pendiente, ligado a la orden de origen |
| 4 | Validaciones del mantenimiento | CORRECTO | Sin próxima fecha ni kilometraje, fecha anterior y kilometraje no mayor: 400 con mensaje claro en cada caso |
| 5 | Reemplazo | CORRECTO | El pendiente anterior del mismo tipo (sin distinguir mayúsculas ni espacios) pasó a Atendido |
| 6 | Mantenimientos próximos y vencidos | CORRECTO | Orden Vencido > Próximo > Normal; teléfono del cliente presente; los atendidos no aparecen |
| 7 | Límites de la clasificación | CORRECTO | 15 días y 500 km: Próximo; 16 días y 501 km: Normal |
| 8 | Recepción solo consulta | CORRECTO | Al registrar un mantenimiento recibe HTTP 403 |
| 9 | Registrar refacción | CORRECTO | Stock 10 con el movimiento "Existencia inicial"; código repetido: 409 con el campo `code` |
| 10 | Entradas y ajustes | CORRECTO | Stock 10 → 15 → 12; un ajuste que dejaría el stock negativo: `INSUFFICIENT_STOCK` con `available` = 12 |
| 11 | Precio de compra | CORRECTO | Mecánico y recepción: la respuesta no trae el campo; administrador: 80.00 |
| 12 | Usar refacciones | CORRECTO | Stock 5 → 3, salida ligada a la orden y total 200.00 |
| 13 | Stock insuficiente | CORRECTO | `INSUFFICIENT_STOCK` (disponible 3); el stock no cambió |
| 14 | Uso simultáneo | CORRECTO | Dos mecánicos por la última pieza: respuestas 201 y 409; stock final 0 |
| 15 | Editar y quitar | CORRECTO | Stock 3 → 4 al reducir la cantidad → 5 al quitar la refacción |
| 16 | Precio congelado | CORRECTO | La orden anterior conserva 100.00; la nueva usa 999.00 |
| 17 | Órdenes cerradas y permisos | CORRECTO | Orden terminada 409; otro mecánico 403; recepción 403 |
| 18 | Cancelar una orden con refacciones | CORRECTO | Stock 2 → 6 con el movimiento "Cancelación de la orden OS-…" |
| 19 | Alertas de stock bajo | CORRECTO | Aparece en el filtro de bajas y, al registrar una entrada que supera el mínimo, el resumen baja de 3 a 2 con stock bajo |
| 20 | Advertencia al usar | CORRECTO | La API marca `LOW` y rechaza más piezas de las disponibles; la advertencia visual se cubre con la prueba de widgets |
| 21 | Desactivar | CORRECTO | `PART_INACTIVE` al usarla; el mecánico ya no la ve (404); conserva su historial; no existe ruta para eliminarla |
| 22 | Datos de ejemplo | CORRECTO | 14 refacciones (11 en orden, 2 con stock bajo, 1 agotada); mantenimientos Normal, Próximo y Vencido; el historial de JKL-012-D trae 1 servicio con 2 refacciones |
| S1 | Sin token → 401; errores sin trazas internas | CORRECTO | `GET /parts` sin token: 401; id inválido: 400 |
| S2 | Invariante global del inventario | CORRECTO | 22 refacciones revisadas, 0 con diferencia entre `stock` y la suma de sus movimientos |

**Total: 24/24 correctos.**

## Pruebas automatizadas al cierre

- Backend: **1,037 pruebas** en 54 suites (unitarias, de integración y de contrato contra `motorix_sdd_test`), incluidas la
  prueba exhaustiva del clasificador de mantenimientos, las diez peticiones simultáneas por la última pieza, la reversa
  al cancelar, la auditoría de la invariante del stock y la matriz de permisos por rol con los 16 endpoints nuevos. ESLint
  sin problemas.
- Frontend: **185 pruebas** de providers y widgets, incluida la de diseño adaptable con las pantallas nuevas en anchos de
  1400, 1000, 760 y 600 px. `flutter analyze` sin problemas.

## Defectos hallados y corregidos durante la implementación

- Los mensajes de validación de los campos femeninos del catálogo decían "La categoría es obligatorio." (concordancia de
  género); ahora dicen "obligatoria" en el servidor y en el formulario.
- El orden por urgencia mezclaba días y kilómetros sin criterio: se fijó una equivalencia de 50 km por día, documentada
  en el clasificador y cubierta por pruebas.
- Al agregar el campo del kilometraje del servicio, el formulario de trabajo creció y los botones quedaron fuera de la
  ventana de 900 px en dos pruebas del Sprint 2; las pruebas ahora desplazan hasta el botón antes de tocarlo.

## Qué no cubre esta validación

- Las pantallas de Flutter se verificaron con pruebas de widgets, no con una revisión visual manual en una ventana real,
  ni se ejecutó la aplicación Flutter conectada a esta API en un navegador o en Windows de escritorio.
- Las pruebas de widgets usan la fuente de prueba de Flutter (cada letra ocupa 14 px), que ensancha los textos; con la
  tipografía real (IBM Plex Sans) el diseño es más holgado.
- La concurrencia se probó con diez peticiones simultáneas por la última pieza y con dos mecánicos reales; no se hicieron
  pruebas de carga.
- La equivalencia de 50 km por día solo ordena los mantenimientos dentro de un mismo grupo; no afecta la clasificación.
