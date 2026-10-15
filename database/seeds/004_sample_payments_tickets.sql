-- Seed 004 (Sprint 4): pagos y tickets de ejemplo sobre las órdenes terminadas y entregadas.
-- Es idempotente: se puede ejecutar varias veces sin duplicar registros.
--   * Pagos de Mercado Pago: por `external_reference` (única); llevan la palabra EJEMPLO y nunca se
--     consultan en Mercado Pago real.
--   * Pagos manuales: solo si no existe otro de la misma orden con el mismo método, importe y referencia.
--   * Tickets: uno por orden (solo si la orden no tiene ya uno); el folio TK- se asigna al final.
-- Requiere las migraciones 001 a 004, los usuarios `admin` y `recepcion` (los crea server/scripts/seed.js)
-- y los seeds 001 a 003. Las fechas son relativas al momento de la primera carga. No contiene
-- secretos ni datos de tarjeta: `reference` es solo una autorización u operación ficticia.
--
-- Resultado: 8 pagos (4 manuales aprobados, 1 manual anulado y 3 de Mercado Pago: aprobado, pendiente
-- y cancelado) sobre las 7 órdenes terminadas y entregadas: 3 pagadas, 2 con pago parcial y 2 sin
-- pagar; y 5 tickets. "Cobrado hoy" del panel es mayor a cero.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------------------------
-- Pagos manuales (efectivo, tarjeta y transferencia) y un pago anulado con motivo.
--   RTY195B  Servicio de 20,000 km ............ efectivo por el total, hoy            → PAGADA
--   ZXC159K  Cambio de banda ................... tarjeta por el total con autorización → PAGADA
--   PRD482A  Afinación mayor ................... abono por transferencia                → PARCIAL
--   ASD836J  Cambio de aceite .................. abono en efectivo hoy (+ cobro MP pendiente) → PARCIAL
--   PRD482A  Servicio de 40,000 km ............. efectivo anulado por cobro duplicado   → SIN PAGAR
-- ---------------------------------------------------------------------------------------------
INSERT INTO payments
  (order_id, method, amount, status, reference, void_reason, voided_by, voided_at, created_by, created_at)
SELECT o.id, t.method, t.amount, t.status, t.reference,
       IF(t.status = 'ANULADO', t.void_reason, NULL),
       IF(t.status = 'ANULADO', a.id, NULL),
       IF(t.status = 'ANULADO', DATE_SUB(NOW(), INTERVAL t.days - 1 DAY), NULL),
       r.id, DATE_SUB(NOW(), INTERVAL t.days DAY)
FROM (
  SELECT 'RTY195B' AS plate, 'Servicio de 20,000 km' AS problem, 'CASH' AS method, 1190.00 AS amount,
         'APROBADO' AS status, CAST(NULL AS CHAR(100)) AS reference, CAST(NULL AS CHAR(255)) AS void_reason, 0 AS days
  UNION ALL SELECT 'ZXC159K', 'Cambio de banda y revisión general', 'CARD', 1395.00, 'APROBADO',
         'AUT-EJEMPLO-4521', NULL, 1
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'TRANSFER', 1000.00, 'APROBADO',
         'SPEI-EJEMPLO-0001', NULL, 2
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'CASH', 400.00, 'APROBADO', NULL, NULL, 0
  UNION ALL SELECT 'PRD482A', 'Cambio de aceite y filtro (servicio de 40,000 km)', 'CASH', 2110.00, 'ANULADO',
         NULL, 'Cobro duplicado capturado por error', 3
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
JOIN users r ON r.username = 'recepcion'
JOIN users a ON a.username = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM payments p
  WHERE p.order_id = o.id AND p.method = t.method AND p.amount = t.amount AND p.reference <=> t.reference
);

-- ---------------------------------------------------------------------------------------------
-- Cobros de Mercado Pago (referencias ficticias): uno aprobado, uno pendiente y uno cancelado.
--   PRD482A  Revisión de frenos ................ MP aprobado por el total, hoy         → PAGADA
--   ASD836J  Cambio de aceite .................. MP pendiente (reserva saldo)          → (ver arriba)
--   GHJ771D  Cambio de aceite y filtros ........ MP cancelado (libera el saldo)        → SIN PAGAR
-- ---------------------------------------------------------------------------------------------
INSERT INTO payments
  (order_id, method, amount, status, external_reference, external_id, payment_url, created_by, created_at)
SELECT o.id, 'MERCADO_PAGO', t.amount, t.status, t.external_reference, t.external_id, t.payment_url,
       r.id, DATE_SUB(NOW(), INTERVAL t.days DAY)
FROM (
  SELECT 'PRD482A' AS plate, 'Revisión de frenos y cambio de balatas delanteras' AS problem, 4880.00 AS amount,
         'APROBADO' AS status, 'MTX-EJEMPLO-OS000009-0001' AS external_reference,
         CAST('EJEMPLO-1001' AS CHAR(40)) AS external_id,
         CAST('https://sandbox.mercadopago.example/EJEMPLO-OS000009' AS CHAR(500)) AS payment_url, 0 AS days
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 500.00, 'PENDIENTE', 'MTX-EJEMPLO-OS000007-0002',
         NULL, 'https://sandbox.mercadopago.example/EJEMPLO-OS000007', 0
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 800.00, 'CANCELADO', 'MTX-EJEMPLO-OS000006-0003',
         NULL, 'https://sandbox.mercadopago.example/EJEMPLO-OS000006', 1
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
JOIN users r ON r.username = 'recepcion'
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.external_reference = t.external_reference);

-- ---------------------------------------------------------------------------------------------
-- Tickets: para las órdenes pagadas y las de abono parcial. El folio TK- se asigna al final.
-- ---------------------------------------------------------------------------------------------
INSERT INTO tickets (order_id, generated_by, created_at)
SELECT o.id, r.id, DATE_SUB(NOW(), INTERVAL t.days DAY)
FROM (
  SELECT 'RTY195B' AS plate, 'Servicio de 20,000 km' AS problem, 0 AS days
  UNION ALL SELECT 'ZXC159K', 'Cambio de banda y revisión general', 1
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 2
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 0
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 0
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
JOIN users r ON r.username = 'recepcion'
WHERE NOT EXISTS (SELECT 1 FROM tickets k WHERE k.order_id = o.id);

UPDATE tickets SET folio = CONCAT('TK-', LPAD(id, 6, '0')) WHERE folio IS NULL;
