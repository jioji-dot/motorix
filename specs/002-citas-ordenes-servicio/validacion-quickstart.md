# Validación de extremo a extremo: Sprint 2

Resultado de ejecutar los escenarios de [quickstart.md](quickstart.md) contra la **API real en ejecución**, conectada a la base local `motorix_sdd` (MySQL 8.0, puerto 3307), con los datos de ejemplo cargados por `npm run seed`.

- **Fecha**: 2026-10-19
- **Método**: script que llama a la API con las cuentas iniciales (`admin`, `recepcion`, `mecanico` y `mecanico2`; las contraseñas se leen del `.env` local y no se imprimen) y comprueba el código HTTP y el contenido de cada respuesta.
- **Limpieza**: los datos temporales creados por la validación (prefijo `QS2`) se eliminaron al terminar. La base quedó con los datos de ejemplo: 4 usuarios, 6 clientes, 8 vehículos, 8 citas y 7 órdenes con 7 servicios, 3 manos de obra y 22 registros de historial.

## Resultados

| # | Escenario | Resultado | Detalle |
|---|-----------|-----------|---------|
| 1 | Agendar y consultar cita | CORRECTO | alta 201 PENDIENTE; la agenda filtrada por fecha y estado la encuentra |
| 2 | Vehículo de otro cliente → rechazo | CORRECTO | HTTP 400: "El vehículo no pertenece al cliente seleccionado." |
| 3 | Fecha pasada rechazada; duplicado avisa y se acepta al confirmar | CORRECTO | pasada 400; duplicada 409; confirmada 201 |
| 4 | Confirmar y cambiar la hora | CORRECTO | CONFIRMADA; nueva hora 11:30 |
| 5 | Crear la orden desde la cita | CORRECTO | OS-000008 RECIBIDO; cita EN_PROCESO; kilometraje del vehículo 41000 |
| 6 | Cancelar una cita con orden → rechazo | CORRECTO | HTTP 409: APPOINTMENT_HAS_ORDER |
| 7 | Kilometraje menor y fuera de rango | CORRECTO | menor 409; mayor a 1,500,000 400; con corrección 201 |
| 8 | Mecánico obligatorio y activo | CORRECTO | sin mecánico 400; mecánico inactivo 400 |
| 9 | Cada mecánico ve solo sus órdenes | CORRECTO | mecánico 1: 6 órdenes, mecánico 2: 4; orden ajena HTTP 403; forzar `mechanicId` no funciona |
| 10 | Documentar el trabajo y total calculado | CORRECTO | total 1700.50 = 900.00 + 350.50 + 450.00 |
| 11 | Secuencia de estados y salto rechazado | CORRECTO | RECIBIDO → DIAGNOSTICO → EN_REPARACION; salto a ENTREGADO: INVALID_TRANSITION (permitidas: EN_REPARACION) |
| 12 | Terminar exige diagnóstico y servicios | CORRECTO | sin documentar: ORDER_INCOMPLETE; documentada: TERMINADO |
| 13 | Esperando refacción y regreso | CORRECTO | EN_REPARACION → ESPERANDO_REFACCION → EN_REPARACION |
| 14 | Entregar: solo recepción; cita completada; orden inmutable | CORRECTO | mecánico 403; recepción 200; cita COMPLETADA; editar entregada 409 |
| 15 | Cancelar orden: motivo obligatorio; la cita vuelve a Confirmada | CORRECTO | mecánico 403; sin motivo 400; recepción 200; cita CONFIRMADA |
| 16 | Cambio simultáneo: aplica uno y el otro recibe STATE_CONFLICT | CORRECTO | respuestas 200 y 409 |
| 17 | Datos de ejemplo al instalar | CORRECTO | 8 citas en 5 estados; 7 órdenes en 7 estados; 2 mecánicos |
| S1 | Sin token → 401; errores sin trazas internas | CORRECTO | GET /orders sin token: 401; id inválido: 400 |

**Total: 18/18 correctos.**

## Pruebas automatizadas al cierre

- Backend: **779 pruebas** en 30 suites (unitarias, de integración y de contrato contra `motorix_sdd_test`), incluida la prueba exhaustiva de la máquina de estados (196 combinaciones) y la matriz de permisos por rol (162 casos). ESLint sin problemas.
- Frontend: **112 pruebas** de providers y widgets, incluida la de diseño adaptable (6 casos). `flutter analyze` sin problemas.

## Qué no cubre esta validación

- Las pantallas de Flutter se verificaron con pruebas de widgets, no con una revisión visual manual en una ventana real, ni se ejecutó la aplicación Flutter conectada a esta API en un navegador o en Windows de escritorio.
- Las pruebas de widgets usan la fuente de prueba de Flutter (cada letra ocupa 14 px), que ensancha los textos; el comportamiento con la tipografía real (IBM Plex Sans) es más holgado.
- La concurrencia se probó con dos peticiones simultáneas; no se hicieron pruebas de carga.
