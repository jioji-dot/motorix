-- Seed 004 (Sprint 2): órdenes de servicio de ejemplo, una por estado, repartidas entre dos mecánicos.
-- Idempotente: cada orden se inserta solo si el vehículo no tiene ya una orden con ese problema reportado,
-- y sus servicios, mano de obra e historial se agregan solo si faltan.
-- Requiere los usuarios (recepcion, mecanico, mecanico2) del script npm run seed y las citas del seed 003.

-- 1. Órdenes -------------------------------------------------------------------------------------------------
INSERT INTO service_orders
  (appointmentId, clientId, vehicleId, mechanicId, entryMileage, reportedProblem, diagnosis, notes, recommendations,
   status, cancellationReason, deliveredAt, createdBy, createdAt)
SELECT
  (SELECT a.id FROM appointments a WHERE a.vehicleId = v.id AND a.reason = d.apptReason LIMIT 1),
  v.clientId, v.id,
  (SELECT u.id FROM users u WHERE u.username = d.mech LIMIT 1),
  d.km, d.problem, d.diag, d.notes, d.recs, d.status, d.cancelReason,
  IF(d.delivered = 1, DATE_SUB(NOW(), INTERVAL (d.daysAgo - 1) DAY), NULL),
  (SELECT u.id FROM users u WHERE u.username = 'recepcion' LIMIT 1),
  DATE_SUB(NOW(), INTERVAL d.daysAgo DAY)
FROM (
  SELECT 'GHI-789-C' AS plate, 'mecanico2' AS mech, 31250 AS km, 'Ruido al frenar' AS problem,
         NULL AS diag, NULL AS notes, NULL AS recs, 'RECIBIDO' AS status, NULL AS cancelReason,
         0 AS delivered, 1 AS daysAgo, NULL AS apptReason
  UNION ALL SELECT 'TAX-001-A', 'mecanico', 210400, 'Vibración al acelerar',
         NULL, 'Revisar también el balanceo.', NULL, 'DIAGNOSTICO', NULL, 0, 2, NULL
  UNION ALL SELECT 'DEF-456-B', 'mecanico', 96500, 'Ruido en el motor',
         'Banda de accesorios desgastada y tensor con juego.', 'Se escucha más en frío.', 'Revisar el alternador en el próximo servicio.',
         'EN_REPARACION', NULL, 0, 0, 'Ruido en el motor'
  UNION ALL SELECT 'TAX-003-A', 'mecanico2', 187300, 'Fuga de aceite',
         'Empaque de la tapa de punterías dañado.', NULL, NULL, 'ESPERANDO_REFACCION', NULL, 0, 3, NULL
  UNION ALL SELECT 'MNO-345-E', 'mecanico2', 74100, 'Luz de check engine encendida',
         'Sensor de oxígeno defectuoso.', NULL, 'Revisar el catalizador si la luz vuelve a encender.', 'TERMINADO', NULL, 0, 4, NULL
  UNION ALL SELECT 'JKL-012-D', 'mecanico', 132800, 'Cambio de batería',
         'Batería sin carga, terminales sulfatadas.', 'Se limpiaron los bornes.', 'Revisar el sistema de carga en 6 meses.',
         'ENTREGADO', NULL, 1, 5, 'Cambio de batería'
  UNION ALL SELECT 'ABC-123-A', 'mecanico', 48200, 'Revisión de suspensión',
         NULL, NULL, NULL, 'CANCELADA', 'El cliente decidió llevar el vehículo a otro taller.', 0, 6, NULL
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
WHERE NOT EXISTS (
  SELECT 1 FROM service_orders x WHERE x.vehicleId = v.id AND x.reportedProblem = d.problem
);

-- Folio legible OS-000123 a partir del id (las órdenes creadas por la aplicación lo reciben al crearse).
UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL;

-- 2. Servicios realizados --------------------------------------------------------------------------------------
INSERT INTO order_services (orderId, description, amount)
SELECT o.id, d.description, d.amount
FROM (
  SELECT 'DEF-456-B' AS plate, 'Ruido en el motor' AS problem, 'Banda de accesorios nueva' AS description, 680.00 AS amount
  UNION ALL SELECT 'DEF-456-B', 'Ruido en el motor', 'Tensor de banda', 540.00
  UNION ALL SELECT 'TAX-003-A', 'Fuga de aceite', 'Diagnóstico de la fuga', 250.00
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'Sensor de oxígeno', 1450.00
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'Lectura y borrado de códigos', 300.00
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'Batería nueva 12V', 2100.00
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'Limpieza de bornes', 120.00
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
JOIN service_orders o ON o.vehicleId = v.id AND o.reportedProblem = d.problem
WHERE NOT EXISTS (SELECT 1 FROM order_services s WHERE s.orderId = o.id AND s.description = d.description);

-- 3. Mano de obra (el importe es una columna calculada: horas × tarifa) -----------------------------------------
INSERT INTO order_labor (orderId, description, hours, hourlyRate)
SELECT o.id, d.description, d.hours, d.rate
FROM (
  SELECT 'DEF-456-B' AS plate, 'Ruido en el motor' AS problem, 'Cambio de banda y tensor' AS description, 1.50 AS hours, 350.00 AS rate
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'Reemplazo del sensor', 1.00, 350.00
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'Instalación y prueba de carga', 0.75, 350.00
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
JOIN service_orders o ON o.vehicleId = v.id AND o.reportedProblem = d.problem
WHERE NOT EXISTS (SELECT 1 FROM order_labor l WHERE l.orderId = o.id AND l.description = d.description);

-- 4. Historial de estados, coherente con el estado actual de cada orden ---------------------------------------
INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy, reason, changedAt)
SELECT o.id, d.fromStatus, d.toStatus,
       (SELECT u.id FROM users u WHERE u.username = d.usr LIMIT 1),
       d.reason, DATE_ADD(o.createdAt, INTERVAL d.mins MINUTE)
FROM (
  -- Ruido al frenar (RECIBIDO)
  SELECT 'GHI-789-C' AS plate, 'Ruido al frenar' AS problem, NULL AS fromStatus, 'RECIBIDO' AS toStatus,
         'recepcion' AS usr, NULL AS reason, 0 AS mins
  -- Vibración al acelerar (DIAGNOSTICO)
  UNION ALL SELECT 'TAX-001-A', 'Vibración al acelerar', NULL, 'RECIBIDO', 'recepcion', NULL, 0
  UNION ALL SELECT 'TAX-001-A', 'Vibración al acelerar', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, 30
  -- Ruido en el motor (EN_REPARACION)
  UNION ALL SELECT 'DEF-456-B', 'Ruido en el motor', NULL, 'RECIBIDO', 'recepcion', NULL, 0
  UNION ALL SELECT 'DEF-456-B', 'Ruido en el motor', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, 20
  UNION ALL SELECT 'DEF-456-B', 'Ruido en el motor', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico', NULL, 75
  -- Fuga de aceite (ESPERANDO_REFACCION)
  UNION ALL SELECT 'TAX-003-A', 'Fuga de aceite', NULL, 'RECIBIDO', 'recepcion', NULL, 0
  UNION ALL SELECT 'TAX-003-A', 'Fuga de aceite', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico2', NULL, 25
  UNION ALL SELECT 'TAX-003-A', 'Fuga de aceite', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico2', NULL, 90
  UNION ALL SELECT 'TAX-003-A', 'Fuga de aceite', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'mecanico2', NULL, 120
  -- Luz de check engine encendida (TERMINADO)
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', NULL, 'RECIBIDO', 'recepcion', NULL, 0
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico2', NULL, 15
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico2', NULL, 60
  UNION ALL SELECT 'MNO-345-E', 'Luz de check engine encendida', 'EN_REPARACION', 'TERMINADO', 'mecanico2', NULL, 180
  -- Cambio de batería (ENTREGADO)
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', NULL, 'RECIBIDO', 'recepcion', NULL, 0
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, 10
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'DIAGNOSTICO', 'EN_REPARACION', 'mecanico', NULL, 40
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'EN_REPARACION', 'TERMINADO', 'mecanico', NULL, 100
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 'TERMINADO', 'ENTREGADO', 'recepcion', NULL, 130
  -- Revisión de suspensión (CANCELADA)
  UNION ALL SELECT 'ABC-123-A', 'Revisión de suspensión', NULL, 'RECIBIDO', 'recepcion', NULL, 0
  UNION ALL SELECT 'ABC-123-A', 'Revisión de suspensión', 'RECIBIDO', 'DIAGNOSTICO', 'mecanico', NULL, 20
  UNION ALL SELECT 'ABC-123-A', 'Revisión de suspensión', 'DIAGNOSTICO', 'CANCELADA', 'recepcion',
         'El cliente decidió llevar el vehículo a otro taller.', 50
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
JOIN service_orders o ON o.vehicleId = v.id AND o.reportedProblem = d.problem
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.orderId = o.id AND h.toStatus = d.toStatus);

-- 5. Totales: servicios + mano de obra -----------------------------------------------------------------------
UPDATE service_orders o
   SET o.total = (SELECT COALESCE(SUM(s.amount), 0) FROM order_services s WHERE s.orderId = o.id)
               + (SELECT COALESCE(SUM(l.amount), 0) FROM order_labor l WHERE l.orderId = o.id);
