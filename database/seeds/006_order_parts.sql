-- Seed 006 (Sprint 3): refacciones usadas en las órdenes de ejemplo (en curso, terminada y entregada),
-- con sus salidas de inventario ligadas a la orden, el kilometraje del servicio y los totales recalculados.
-- Idempotente: cada línea y cada salida se agregan solo si faltan. Requiere los seeds 004 y 005.

-- 1. Líneas de refacciones usadas ------------------------------------------------------------------------------------
INSERT INTO order_parts (orderId, partId, partCode, partName, quantity, unitPrice)
SELECT o.id, p.id, p.code, p.name, d.qty, p.salePrice
FROM (
  SELECT 'DEF-456-B' AS plate, 'Ruido en el motor' AS problem, 'BAN-ACC-01' AS code, 1 AS qty
  UNION ALL SELECT 'DEF-456-B', 'Ruido en el motor', 'TEN-BAN-01', 1
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'SEN-O2-01', 1
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'BAT-60-01', 1
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'TER-BAT-01', 2
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
JOIN service_orders o ON o.vehicleId = v.id AND o.reportedProblem = d.problem
JOIN parts p ON p.code = d.code
WHERE NOT EXISTS (SELECT 1 FROM order_parts x WHERE x.orderId = o.id AND x.partId = p.id);

-- 2. Salidas de inventario ligadas a la orden (una por línea) ----------------------------------------------------------
INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, orderId, createdBy)
SELECT l.partId, 'OUT', -l.quantity,
       (SELECT COALESCE(SUM(x.quantity), 0) FROM inventory_movements x WHERE x.partId = l.partId) - l.quantity,
       CONCAT('Uso en la orden ', o.folio), o.id, o.mechanicId
FROM order_parts l
JOIN service_orders o ON o.id = l.orderId
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_movements m WHERE m.orderId = o.id AND m.partId = l.partId AND m.type = 'OUT'
);

-- 3. Kilometraje del servicio de las órdenes terminada y entregada (el historial lo muestra) -------------------------------
UPDATE service_orders o
  JOIN vehicles v ON v.id = o.vehicleId
   SET o.serviceMileage = o.entryMileage + 40
 WHERE o.status IN ('TERMINADO', 'ENTREGADO') AND o.serviceMileage IS NULL;

UPDATE vehicles v
  JOIN service_orders o ON o.vehicleId = v.id
   SET v.currentMileage = GREATEST(v.currentMileage, o.serviceMileage)
 WHERE o.serviceMileage IS NOT NULL;

-- 4. Totales de las órdenes: servicios + mano de obra + refacciones ---------------------------------------------------------
UPDATE service_orders o
   SET o.total = (SELECT COALESCE(SUM(s.amount), 0) FROM order_services s WHERE s.orderId = o.id)
               + (SELECT COALESCE(SUM(b.amount), 0) FROM order_labor b WHERE b.orderId = o.id)
               + (SELECT COALESCE(SUM(r.amount), 0) FROM order_parts r WHERE r.orderId = o.id)
 WHERE EXISTS (SELECT 1 FROM order_parts r WHERE r.orderId = o.id);

-- 5. El stock de cada refacción vuelve a ser la suma de sus movimientos -----------------------------------------------------
UPDATE parts p
   SET p.stock = (SELECT COALESCE(SUM(m.quantity), 0) FROM inventory_movements m WHERE m.partId = p.id);
