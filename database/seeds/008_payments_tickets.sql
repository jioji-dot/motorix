-- Seed 008 (Sprint 4): pagos y ticket de ejemplo sobre las órdenes terminadas y entregada del seed 004.
-- Idempotente: cada pago se inserta solo si su referencia de ejemplo no existe y el ticket solo si la orden no tiene uno.
-- Los importes se calculan con el total real de cada orden. Requiere los seeds 004 a 006 y el usuario `recepcion`.
-- Ningún dato de tarjeta: las referencias son números de autorización o de transferencia de ejemplo.

-- 1. Orden Entregada (cambio de batería): cobrada completa, en efectivo y con tarjeta ------------------------------------
INSERT INTO payments (orderId, amount, method, status, reference, paidAt, createdBy, createdAt)
SELECT o.id, 3000.00, 'EFECTIVO', 'PAGADO', 'Datos de ejemplo: efectivo', DATE_SUB(NOW(), INTERVAL 4 DAY),
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1), DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM service_orders o
JOIN vehicles v ON v.id = o.vehicleId
WHERE v.licensePlate = 'JKL-012-D' AND o.reportedProblem = 'Cambio de batería' AND o.total > 3000
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.orderId = o.id AND p.reference = 'Datos de ejemplo: efectivo');

INSERT INTO payments (orderId, amount, method, status, reference, paidAt, createdBy, createdAt)
SELECT o.id, o.total - 3000.00, 'TARJETA', 'PAGADO', 'AUT 458213', DATE_SUB(NOW(), INTERVAL 4 DAY),
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1), DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM service_orders o
JOIN vehicles v ON v.id = o.vehicleId
WHERE v.licensePlate = 'JKL-012-D' AND o.reportedProblem = 'Cambio de batería' AND o.total > 3000
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.orderId = o.id AND p.reference = 'AUT 458213');

-- 2. Orden Terminada (sensor de oxígeno): pago parcial por transferencia y un intento de Mercado Pago rechazado -----------------
INSERT INTO payments (orderId, amount, method, status, reference, paidAt, createdBy, createdAt)
SELECT o.id, 1500.00, 'TRANSFERENCIA', 'PAGADO', 'SPEI 0045871236', DATE_SUB(NOW(), INTERVAL 1 DAY),
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM service_orders o
JOIN vehicles v ON v.id = o.vehicleId
WHERE v.licensePlate = 'MNO-345-E' AND o.reportedProblem = 'Luz de check engine encendida' AND o.total > 1500
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.orderId = o.id AND p.reference = 'SPEI 0045871236');

INSERT INTO payments (orderId, amount, method, status, reference, externalReference, createdBy, createdAt)
SELECT o.id, o.total - 1500.00, 'MERCADO_PAGO', 'RECHAZADO', 'Datos de ejemplo: intento rechazado', 'seed-mp-rechazado-1',
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1), DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM service_orders o
JOIN vehicles v ON v.id = o.vehicleId
WHERE v.licensePlate = 'MNO-345-E' AND o.reportedProblem = 'Luz de check engine encendida' AND o.total > 1500
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.externalReference = 'seed-mp-rechazado-1');

-- 3. Ticket de la orden Entregada, con su último pago como pago principal ------------------------------------------------------
INSERT INTO tickets (folio, orderId, paymentId, generatedBy, generatedAt)
SELECT CONCAT('TMP-', LEFT(REPLACE(UUID(), '-', ''), 15)), o.id,
       (SELECT p.id FROM payments p WHERE p.orderId = o.id AND p.status = 'PAGADO' ORDER BY p.id DESC LIMIT 1),
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1), DATE_SUB(NOW(), INTERVAL 4 DAY)
FROM service_orders o
JOIN vehicles v ON v.id = o.vehicleId
WHERE v.licensePlate = 'JKL-012-D' AND o.reportedProblem = 'Cambio de batería'
  AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.orderId = o.id);

-- Folio legible TK-000123 a partir del id (los tickets creados por la aplicación lo reciben al generarse).
UPDATE tickets SET folio = CONCAT('TK-', LPAD(id, 6, '0')) WHERE folio LIKE 'TMP-%';
