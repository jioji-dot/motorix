-- Seed 009 (Sprint 6): datos de ejemplo para el centro de notificaciones y la lista de clientes por avisar.
-- Se apoya en los seeds anteriores (mantenimientos próximos y vencidos, stock bajo y agotado, una orden Terminada y una
-- cita de mañana) y agrega lo que faltaba: una cita para hoy, una orden detenida de un mecánico y un cliente ya avisado.
-- Las fechas son relativas al momento de la carga (NOW), así que los avisos existen sin importar cuándo se cargue.
-- Idempotente: cada fila se inserta solo si todavía no existe.
-- Requiere los seeds 002, 003, 004 y 007 y los usuarios (recepcion, mecanico) del script npm run seed.

-- 1. Cita de hoy (Confirmada): aparece como aviso de «cita de hoy» aunque su hora ya haya pasado ---------------------
INSERT INTO appointments (clientId, vehicleId, scheduledAt, reason, notes, status, createdBy)
SELECT v.clientId, v.id, CURDATE() + INTERVAL 16 HOUR, 'Revisión de niveles y llantas', 'Se recuerda a la persona al llegar.', 'CONFIRMADA',
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1)
FROM vehicles v
WHERE v.licensePlate = 'ABC-123-A'
  AND NOT EXISTS (SELECT 1 FROM appointments x WHERE x.vehicleId = v.id AND x.reason = 'Revisión de niveles y llantas');

-- 2. Orden detenida: En reparación, sin cambio de estado desde hace 5 días y asignada al mecánico de ejemplo --------
INSERT INTO service_orders
  (appointmentId, clientId, vehicleId, mechanicId, entryMileage, reportedProblem, diagnosis, status, createdBy, createdAt)
SELECT NULL, v.clientId, v.id,
       (SELECT id FROM users WHERE username = 'mecanico' LIMIT 1),
       v.currentMileage, 'Vibración en el volante a alta velocidad', 'Balanceo y alineación fuera de rango.', 'EN_REPARACION',
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1),
       DATE_SUB(NOW(), INTERVAL 7 DAY)
FROM vehicles v
WHERE v.licensePlate = 'TAX-002-A'
  AND NOT EXISTS (SELECT 1 FROM service_orders x WHERE x.vehicleId = v.id AND x.reportedProblem = 'Vibración en el volante a alta velocidad');

UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL;

-- Historial de estados: el último cambio fue hace 5 días (7 de antigüedad menos 2 días de avance).
INSERT INTO order_status_history (orderId, fromStatus, toStatus, changedBy, reason, changedAt)
SELECT o.id, d.fromStatus, d.toStatus, (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1), d.reason,
       DATE_ADD(o.createdAt, INTERVAL d.mins MINUTE)
FROM (
  SELECT NULL AS fromStatus, 'RECIBIDO' AS toStatus, NULL AS reason, 0 AS mins
  UNION ALL SELECT 'RECIBIDO', 'DIAGNOSTICO', NULL, 1440
  UNION ALL SELECT 'DIAGNOSTICO', 'EN_REPARACION', 'Se espera el balanceo.', 2880
) AS d
JOIN vehicles v ON v.licensePlate = 'TAX-002-A'
JOIN service_orders o ON o.vehicleId = v.id AND o.reportedProblem = 'Vibración en el volante a alta velocidad'
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.orderId = o.id AND h.toStatus = d.toStatus);

-- 3. Un cliente ya avisado: la afinación vencida de TAX-001-A; el vencido de TAX-003-A sigue pendiente ---------------
INSERT INTO client_notices (clientId, kind, factId, noticedBy, noticedAt, note)
SELECT v.clientId, 'MANTENIMIENTO_VENCIDO', m.id, (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1),
       DATE_SUB(NOW(), INTERVAL 1 DAY), 'Avisado por teléfono; vendrá el sábado.'
FROM maintenance m
JOIN vehicles v ON v.id = m.vehicleId
WHERE v.licensePlate = 'TAX-001-A' AND m.serviceType = 'Afinación mayor' AND m.status = 'PENDIENTE'
  AND NOT EXISTS (SELECT 1 FROM client_notices n WHERE n.kind = 'MANTENIMIENTO_VENCIDO' AND n.factId = m.id);
