-- Seed 003 (Sprint 2): citas de ejemplo, una por estado y varias próximas.
-- Idempotente: cada cita se inserta solo si el vehículo no tiene ya una cita con ese motivo.
-- Las fechas son relativas a la fecha de carga (CURDATE()) para que la agenda siempre tenga citas próximas.
-- Las citas EN_PROCESO y COMPLETADA se enlazan con las órdenes del seed 004.

INSERT INTO appointments (clientId, vehicleId, scheduledAt, reason, notes, status, createdBy)
SELECT v.clientId, v.id, d.scheduledAt, d.reason, d.notes, d.status,
       (SELECT id FROM users WHERE username = 'recepcion' LIMIT 1)
FROM (
  SELECT 'ABC-123-A' AS plate, DATE_ADD(CURDATE(), INTERVAL 2 DAY) + INTERVAL 9 HOUR AS scheduledAt,
         'Cambio de aceite y filtros' AS reason, 'El cliente pide revisar también las llantas.' AS notes, 'PENDIENTE' AS status
  UNION ALL SELECT 'GHI-789-C', DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 11 HOUR, 'Revisión de frenos', NULL, 'CONFIRMADA'
  UNION ALL SELECT 'TAX-001-A', DATE_ADD(CURDATE(), INTERVAL 3 DAY) + INTERVAL 510 MINUTE, 'Afinación mayor', 'Unidad de flotilla.', 'CONFIRMADA'
  UNION ALL SELECT 'MNO-345-E', DATE_ADD(CURDATE(), INTERVAL 5 DAY) + INTERVAL 16 HOUR, 'Revisión de suspensión', NULL, 'PENDIENTE'
  UNION ALL SELECT 'TAX-003-A', DATE_ADD(CURDATE(), INTERVAL 7 DAY) + INTERVAL 10 HOUR, 'Diagnóstico general', NULL, 'CONFIRMADA'
  UNION ALL SELECT 'DEF-456-B', CURDATE() + INTERVAL 8 HOUR, 'Ruido en el motor', 'Llegó por la mañana.', 'EN_PROCESO'
  UNION ALL SELECT 'JKL-012-D', DATE_SUB(CURDATE(), INTERVAL 5 DAY) + INTERVAL 10 HOUR, 'Cambio de batería', NULL, 'COMPLETADA'
  UNION ALL SELECT 'TAX-002-A', DATE_SUB(CURDATE(), INTERVAL 2 DAY) + INTERVAL 15 HOUR, 'Alineación y balanceo', 'El cliente canceló.', 'CANCELADA'
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
WHERE NOT EXISTS (
  SELECT 1 FROM appointments x WHERE x.vehicleId = v.id AND x.reason = d.reason
);
