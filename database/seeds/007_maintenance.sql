-- Seed 007 (Sprint 3): mantenimientos programados de ejemplo en cada clasificación.
-- Las fechas y los kilometrajes son relativos a hoy y al kilometraje actual de cada vehículo, así que la clasificación
-- (Normal, Próximo, Vencido por fecha, Vencido por kilometraje) se mantiene sin importar cuándo se cargue.
-- Idempotente: cada mantenimiento se inserta solo si el vehículo no tiene ya uno del mismo tipo y estado.
-- Requiere los seeds 002 y 006 (kilometrajes actualizados) y el usuario `mecanico`.

INSERT INTO maintenance
  (vehicleId, serviceType, lastServiceDate, lastMileage, nextDate, nextMileage, notes, status, completedAt, createdBy)
SELECT v.id, d.serviceType,
       DATE_SUB(CURDATE(), INTERVAL d.lastDaysAgo DAY),
       GREATEST(v.currentMileage - d.lastKmBack, 0),
       IF(d.nextDays IS NULL, NULL, DATE_ADD(CURDATE(), INTERVAL d.nextDays DAY)),
       IF(d.nextKmAhead IS NULL, NULL, v.currentMileage + d.nextKmAhead),
       d.notes, d.status, IF(d.status = 'ATENDIDO', NOW(), NULL),
       (SELECT id FROM users WHERE username = 'mecanico' LIMIT 1)
FROM (
  -- Normal: faltan 60 días y 3,000 km
  SELECT 'ABC-123-A' AS plate, 'Cambio de aceite' AS serviceType, 120 AS lastDaysAgo, 5000 AS lastKmBack,
         60 AS nextDays, 3000 AS nextKmAhead, 'Aceite sintético 5W-30.' AS notes, 'PENDIENTE' AS status
  -- Próximo por fecha: faltan 9 días
  UNION ALL SELECT 'GHI-789-C', 'Cambio de aceite', 170, 4800, 9, NULL, NULL, 'PENDIENTE'
  -- Próximo por kilometraje: faltan 400 km
  UNION ALL SELECT 'DEF-456-B', 'Cambio de frenos', 300, 9600, NULL, 400, 'Revisar el grosor de las balatas.', 'PENDIENTE'
  -- Vencido por fecha: se pasó hace 12 días
  UNION ALL SELECT 'TAX-001-A', 'Afinación mayor', 190, 10000, -12, NULL, 'Taxi de uso intensivo.', 'PENDIENTE'
  -- Vencido por kilometraje: se pasó por 350 km
  UNION ALL SELECT 'TAX-003-A', 'Cambio de aceite', 90, 5350, NULL, -350, NULL, 'PENDIENTE'
  -- Normal con fecha y kilometraje lejanos
  UNION ALL SELECT 'MNO-345-E', 'Rotación de llantas', 100, 7000, 120, 8000, NULL, 'PENDIENTE'
  -- Atendido: ya se reemplazó por un servicio posterior
  UNION ALL SELECT 'JKL-012-D', 'Cambio de batería', 400, 20000, -200, NULL, 'Sustituido por el servicio de la orden entregada.', 'ATENDIDO'
) AS d
JOIN vehicles v ON v.licensePlate = d.plate
WHERE NOT EXISTS (
  SELECT 1 FROM maintenance x WHERE x.vehicleId = v.id AND x.serviceType = d.serviceType AND x.status = d.status
);
