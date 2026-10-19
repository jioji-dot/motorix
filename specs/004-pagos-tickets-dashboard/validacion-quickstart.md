# Validación del quickstart: Sprint 4

**Fecha**: 2026-10-19 | **Base**: `motorix_sdd` (datos de ejemplo cargados con `npm run seed`) | **API**: `http://localhost:3000/api`

Se ejecutaron los escenarios de [`quickstart.md`](quickstart.md) contra la API real con un script que usa las cuentas iniciales
y deja la base como estaba (los datos temporales llevan el prefijo `QS4` y se eliminaron al terminar; la comprobación final no
encontró restos y conservó los 4 pagos y el ticket de ejemplo).

**Cómo se probó Mercado Pago**: no se usó una credencial real. El escenario 12 se ejecutó con la API **sin** `MP_ACCESS_TOKEN`. Los
escenarios 13 a 16 se ejecutaron con la API configurada con una credencial de prueba falsa y `MP_API_URL` apuntando a un **servidor
local que imita a Mercado Pago** (preferencias de pago, consulta y búsqueda de pagos). Así se probó de punta a punta la pasarela real
de Motorix por HTTP, pero **no** contra el sandbox de Mercado Pago. Esa comprobación final necesita una cuenta de vendedor de prueba y
queda pendiente (ver "Qué no cubre esta validación").

## Preparación de la base de datos

| Paso | Resultado |
|------|-----------|
| Aplicar la migración 004 en `motorix_sdd` y `motorix_sdd_test` | Se aplicó la 004 y la 001, 002 y 003 aparecieron como "Ya aplicada" |
| Repetir `aplicar-migraciones.ps1` | La 004 no se volvió a ejecutar ("0 migración(es) nueva(s)") |
| `npm run seed` y repetirlo | Sin errores y sin duplicados: 4 pagos y 1 ticket |
| Datos de ejemplo | Orden Entregada pagada en efectivo y tarjeta con su ticket; orden Terminada con pago parcial por transferencia y un pago de Mercado Pago Rechazado |

## Resultados por escenario

| # | Escenario | Resultado | Evidencia |
|---|-----------|-----------|-----------|
| 1 | Pago en efectivo | CORRECTO | Pagado; resumen "Pago parcial" con saldo 600.00 |
| 2 | Pago por el saldo | CORRECTO | La orden queda Pagada y un pago más responde `PAYMENT_EXCEEDS_BALANCE` |
| 3 | Importe inválido | CORRECTO | Cero, negativo y tres decimales: 400; mayor al saldo: 409 con el saldo disponible (1000.00) |
| 4 | Orden no cobrable | CORRECTO | Orden en curso y cancelada: 409 `ORDER_NOT_PAYABLE` |
| 5 | Métodos y referencia | CORRECTO | Efectivo, transferencia y tarjeta quedan Pagados; método inválido: 400; referencia con número de tarjeta: 400 |
| 6 | Pagos simultáneos | CORRECTO | De 6 cobros simultáneos de 400 sobre 1000.00 se aplicaron 2; pagado 800.00 |
| 7 | Mecánico sin acceso | CORRECTO | Consultar pagos, registrarlos y generar el ticket: 403 |
| 8 | Generar el ticket | CORRECTO | Folio `TK-…`, taller, cliente, vehículo, placas, kilometraje, líneas, subtotal = total y método y estado de pago |
| 9 | Regenerar | CORRECTO | Mismo folio; el estado pasó a Pagada y los métodos a efectivo y transferencia |
| 10 | Ticket sin pagos y orden no elegible | CORRECTO | Sin pagos: estado "Sin pagos" (Pendiente en pantalla); orden en curso: 409 `TICKET_NOT_AVAILABLE` |
| 11 | Imprimir | CORRECTO | Página HTML con el folio, estilos de impresión, sin menús; token alterado y token de sesión: 401; vigencia 300 s (el diálogo de impresión del navegador no se automatizó) |
| 12 | Mercado Pago sin configurar | CORRECTO | 503 `MP_NOT_CONFIGURED` con mensaje claro; no se creó ningún pago; con efectivo se cobró sin problema |
| 13 | Mercado Pago (sandbox simulado) | CORRECTO | Pago Pendiente con enlace; 700.00 reservados y 300.00 disponibles; un cobro de 400 se rechaza; el token no aparece en la respuesta |
| 14 | Resultado de Mercado Pago | CORRECTO | Sin novedades queda Pendiente; tras aprobarse pasa a Pagado; repetir la sincronización: `PAYMENT_NOT_PENDING`; 5 notificaciones repetidas: 200 y un solo cambio |
| 15 | Cancelar un pago pendiente | CORRECTO | Pasa a Cancelado, libera 1000.00 y se conserva en el historial; cancelarlo otra vez: `PAYMENT_NOT_PENDING` |
| 16 | Notificaciones falsas o repetidas | CORRECTO | Inexistente, de otro sistema y de otro tipo: 200; sin formato: 400; ningún pago cambió |
| 17 | Panel del administrador | CORRECTO | Órdenes por estado y por cobrar, citas, mantenimientos, inventario y cobros con datos reales |
| 18 | Coincidencia con los módulos | CORRECTO | Órdenes por estado, mantenimientos (2/2), inventario (2/1) y por cobrar (6 órdenes, 5580.00) coinciden con sus módulos |
| 19 | Panel sin acceso | CORRECTO | Recepción 403, mecánico 403, sin token 401 |
| 20 | Panel sin datos y con error | Cubierto por pruebas automatizadas | `dashboard.empty.test.js` (ceros y listas vacías) y `dashboard_screen_test.dart` (error con "Reintentar"); no se vació la base de ejemplo para probarlo a mano |
| 21 | Datos de ejemplo | CORRECTO | Entregada: Pagada con 2 pagos y ticket `TK-000001`; Terminada: Pago parcial, saldo 2080.00 y un pago de Mercado Pago Rechazado |
| S1 | Sin token → 401; errores sin trazas internas | CORRECTO | Pagos, sincronización y panel sin token: 401; id inválido: 400 |

**Total: 21 de 21 comprobaciones correctas** (20 en la corrida con Mercado Pago simulado y el escenario 12 en la corrida sin credenciales). El escenario 20 se cubre con pruebas automatizadas.

## Pruebas automatizadas al cierre

- Backend: **1,240 pruebas** en 75 suites (unitarias, de integración y de contrato contra `motorix_sdd_test`), incluidas la
  concurrencia de pagos (diez cobros simultáneos), la idempotencia de notificaciones (diez idénticas), la generación simultánea del
  ticket, el esquema sin columnas de tarjeta ni de credenciales, la coincidencia de cada cifra del panel con su módulo y la matriz
  de permisos con los endpoints nuevos y las dos rutas públicas. Las pruebas nunca llaman a Mercado Pago real. ESLint sin problemas.
- Frontend: **242 pruebas** de providers y widgets, incluida la de diseño adaptable con las pantallas nuevas en anchos de 1400,
  1000, 760 y 600 px. `flutter analyze` sin problemas.

## Defectos hallados y corregidos durante la implementación

- La generación simultánea del ticket de una misma orden producía conflictos entre transacciones (bloqueos cruzados al insertar); ahora
  se serializa bloqueando la orden y diez generaciones simultáneas dejan un solo ticket.
- Los identificadores externos de las pruebas de Mercado Pago se repetían entre pruebas y chocaban con la restricción de unicidad; el
  simulador ahora los numera de forma única, como lo hace Mercado Pago.
- El estado de error del bloque de pagos desbordaba en un espacio fijo de 140 px; ahora es un aviso compacto con "Reintentar".
- Los mensajes de los campos femeninos del catálogo de refacciones concordaban en género mal (Sprint 3); se corrigió en ese sprint.

## Qué no cubre esta validación

- **No se probó contra el sandbox real de Mercado Pago**: se usó un servidor local que imita sus respuestas. Falta una corrida con una
  cuenta de vendedor de prueba y una tarjeta de prueba para confirmar el formato real de las respuestas y de las notificaciones
  (incluida la firma `x-signature`, que solo se probó con firmas calculadas por Motorix).
- Las notificaciones reales de Mercado Pago necesitan una dirección pública (`MP_NOTIFICATION_URL`); en local el estado se actualiza con
  "Actualizar estado".
- La impresión se validó hasta la página HTML (contenido, estilos de impresión y token); el diálogo de impresión del navegador no se
  automatizó. Las pantallas de Flutter se verificaron con pruebas de widgets, no con una revisión visual manual en una ventana real, ni se
  ejecutó la aplicación Flutter conectada a esta API.
- Las pruebas de widgets usan la fuente de prueba de Flutter (cada letra ocupa 14 px), que ensancha los textos.
- Límite conocido: la aprobación tardía de un pago de Mercado Pago que recepción ya canceló en Motorix se ignora (se registra una
  advertencia) y se concilia fuera del sistema.
