# Modelo de datos: Pagos, tickets y panel de control

Extiende el esquema de los Sprints 1 a 3. Se implementará en `database/migrations/004_sprint4_payments_tickets.sql` (MySQL 8.0, InnoDB, `utf8mb4`). Tablas y columnas en inglés; los valores de estado y de método usan los nombres de la documentación del proyecto. Ninguna llave foránea es en cascada: los pagos y tickets nunca se eliminan.

## Diagrama de relaciones

```text
service_orders 1 ── * payments * ── 1 users (createdBy)
service_orders 1 ── 0..1 tickets
tickets * ── 0..1 payments        (pago principal al generar o regenerar el ticket)
panel de control ──► lee órdenes, citas, pagos, mantenimientos e inventario   [sin tablas propias]
```

## Tabla `payments`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `orderId` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, INDEX | Orden cobrada (RN-13) |
| `amount` | DECIMAL(10,2) | NOT NULL, CHECK (`amount` > 0) | Importe del pago |
| `method` | ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','MERCADO_PAGO') | NOT NULL | Método de pago |
| `status` | ENUM('PENDIENTE','PAGADO','RECHAZADO','CANCELADO') | NOT NULL, INDEX | Estado del pago |
| `reference` | VARCHAR(100) | NULL | Referencia capturada (número de autorización o de transferencia); nunca datos de tarjeta |
| `externalReference` | VARCHAR(64) | NULL, UNIQUE | Referencia propia que se envía a Mercado Pago (`external_reference`); solo para `MERCADO_PAGO` |
| `externalId` | VARCHAR(40) | NULL, UNIQUE | Identificador del pago en Mercado Pago, cuando lo informa |
| `paymentLink` | VARCHAR(500) | NULL | Enlace de pago de Mercado Pago |
| `paidAt` | DATETIME | NULL | Cuándo quedó Pagado |
| `createdBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quién lo registró |
| `createdAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Registro |
| `updatedAt` | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | Última actualización |

Restricciones de tabla (`CHECK`):
- `amount` > 0;
- solo `MERCADO_PAGO` puede crearse fuera del estado `PAGADO`: `method = 'MERCADO_PAGO' OR status = 'PAGADO'`;
- `paidAt` solo existe si el estado es `PAGADO`: `status = 'PAGADO' OR paidAt IS NULL`;
- los campos de Mercado Pago solo existen para ese método: `method = 'MERCADO_PAGO' OR (externalReference IS NULL AND externalId IS NULL AND paymentLink IS NULL)`.

**Reglas de validación**
- `orderId`: la orden debe existir y estar `TERMINADO` o `ENTREGADO` y tener `total` mayor a cero.
- `amount`: de 0.01 a 99,999,999.99 con hasta dos decimales y no mayor al saldo disponible de la orden (`total` − suma de pagos `PAGADO` y `PENDIENTE`).
- `method`: uno de los cuatro valores; obligatorio.
- `reference`: opcional, hasta 100 caracteres; se rechaza si parece contener un número de tarjeta (13 a 19 dígitos seguidos).
- Estados: `PAGADO` (efectivo, tarjeta y transferencia nacen así); `PENDIENTE` solo en Mercado Pago, con transiciones únicas a `PAGADO`, `RECHAZADO` o `CANCELADO`; los tres son finales. Los pagos no se editan ni se eliminan.
- **Esquema sin datos sensibles (RN-14)**: no existen columnas para número, vencimiento o código de seguridad de tarjetas, ni para credenciales; una prueba inspecciona el esquema.

## Tabla `tickets`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Identificador |
| `folio` | VARCHAR(20) | NOT NULL, UNIQUE | Folio legible `TK-000123` (el id con ceros) |
| `orderId` | INT UNSIGNED | NOT NULL, UNIQUE, FK → `service_orders.id` | Orden del ticket (a lo sumo uno por orden) |
| `paymentId` | INT UNSIGNED | NULL, FK → `payments.id` | Pago principal (el último pago `PAGADO`) al generar o regenerar |
| `generatedBy` | INT UNSIGNED | NOT NULL, FK → `users.id` | Quién lo generó |
| `generatedAt` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Fecha de generación |

**Reglas**
- Solo órdenes `TERMINADO` o `ENTREGADO`.
- El folio se asigna con el id al crear el ticket (igual que el folio de las órdenes) y nunca cambia; regenerar el ticket devuelve el mismo registro y actualiza `paymentId`.
- El contenido (taller, cliente, vehículo, líneas, subtotal, total, método y estado de pago) **no se guarda**: se arma al consultar.

## Contenido del ticket (vista calculada)

| Dato | Origen |
|------|--------|
| Folio y fecha | `tickets.folio`, `tickets.generatedAt` |
| Datos del taller | Variables de entorno `WORKSHOP_NAME`, `WORKSHOP_ADDRESS`, `WORKSHOP_PHONE` |
| Folio de la orden | `service_orders.folio` |
| Cliente | `clients.name`, `clients.phone` |
| Vehículo, placas | `vehicles.brand`, `model`, `year`, `licensePlate` |
| Kilometraje | `COALESCE(service_orders.serviceMileage, service_orders.entryMileage)` |
| Servicios, mano de obra, refacciones | `order_services`, `order_labor`, `order_parts` |
| Subtotal y total | Suma de las líneas (igual que `service_orders.total`; sin impuestos, subtotal = total) |
| Método de pago | Métodos distintos de los pagos `PAGADO` (por ejemplo "Efectivo y tarjeta"); vacío si no hay pagos |
| Estado del pago | `Sin cobro` (total cero), `Pendiente` (sin pagos Pagados), `Pago parcial` o `Pagado` |

## Estado de cobro de una orden (calculado, no se guarda)

Con `total` de la orden, `pagado` = suma de pagos `PAGADO`, `pendiente` = suma de pagos `PENDIENTE` y `saldo` = `total` − `pagado`:

- `SIN_COBRO` si `total` = 0 (no admite pagos);
- `SIN_PAGOS` si `pagado` = 0;
- `PARCIAL` si 0 < `pagado` < `total`;
- `PAGADA` si `pagado` = `total`.

El **saldo disponible** para nuevos pagos es `total` − `pagado` − `pendiente`.

## Panel de control (vista calculada)

No es una tabla. Se calcula al consultarlo, con "hoy" y "mes en curso" en hora local del taller:

| Bloque | Cálculo |
|--------|---------|
| Órdenes | Conteo por estado; cuántas `TERMINADO` o `ENTREGADO` tienen saldo > 0 y la suma de esos saldos |
| Citas | `PENDIENTE` o `CONFIRMADA` con fecha de hoy; las de los próximos 7 días (sin contar hoy) y las 5 más próximas |
| Mantenimientos | Pendientes clasificados `VENCIDO` y `PROXIMO` con el clasificador del Sprint 3 |
| Inventario | Refacciones activas en `LOW` y `OUT` (resumen del Sprint 3) y las 5 más urgentes (agotadas primero, luego menor proporción stock/mínimo) |
| Pagos | Suma de pagos `PAGADO` con `paidAt` de hoy y del mes en curso; pendiente de cobrar = suma de saldos de órdenes `TERMINADO` o `ENTREGADO` |

## Relaciones

- Una orden tiene muchos pagos (cualquier estado) y a lo sumo un ticket; un ticket apunta al pago principal de su orden.
- El panel solo lee las demás entidades y no agrega tablas.

## Datos de ejemplo (seeds)

Idempotentes, con importes calculados desde el total real de cada orden de ejemplo:

- **Orden Entregada** (cambio de batería): pagada en dos partes, efectivo y tarjeta (con referencia de autorización de ejemplo), y con su **ticket generado**.
- **Orden Terminada** (sensor de oxígeno): pago **parcial** por transferencia y un pago de Mercado Pago **Rechazado** de historial; queda con saldo pendiente para que el panel muestre algo por cobrar.
- Las demás órdenes están en curso o canceladas y no admiten pagos.
- Todos los pagos de ejemplo llevan la referencia `Datos de ejemplo` o una de ejemplo para no duplicarse al repetir el seed.
