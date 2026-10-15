-- Seed 002 (Sprint 2): citas y órdenes de servicio de ejemplo.
-- Es idempotente: se puede ejecutar varias veces sin duplicar registros.
--   * Citas: se insertan solo si no existe otra del mismo vehículo y motivo.
--   * Órdenes: solo si no existe otra del mismo vehículo y problema reportado.
--   * Servicios y mano de obra: por (orden, descripción).
--   * Historial de estados: solo para órdenes que aún no tienen ningún registro de historial.
-- Requiere los usuarios `recepcion` y `mecanico` (los crea server/scripts/seed.js) y los
-- clientes y vehículos del seed 001. Las fechas se calculan a partir de la fecha de la primera carga.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Citas: dos pendientes, una confirmada, una en proceso, una completada y una cancelada.
INSERT INTO appointments (client_id, vehicle_id, scheduled_at, reason, notes, status, created_by)
SELECT v.client_id, v.id, t.scheduled_at, t.reason, t.notes, t.status, r.id
FROM (
  SELECT 'PRD482A' AS plate, TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00') AS scheduled_at, 'Revisión de frenos' AS reason, 'El cliente escucha un rechinido al frenar' AS notes, 'PENDIENTE' AS status
  UNION ALL SELECT 'LMN304C', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 2 DAY), '09:30:00'), 'Servicio de afinación', CAST(NULL AS CHAR), 'PENDIENTE'
  UNION ALL SELECT 'KLP558E', TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 3 DAY), '16:00:00'), 'Cambio de llantas', 'Confirmó por teléfono', 'CONFIRMADA'
  UNION ALL SELECT 'XCV620F', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '11:00:00'), 'Falla en la suspensión', CAST(NULL AS CHAR), 'EN_PROCESO'
  UNION ALL SELECT 'ASD836J', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '09:00:00'), 'Cambio de aceite programado', CAST(NULL AS CHAR), 'COMPLETADA'
  UNION ALL SELECT 'QWE247H', TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '12:30:00'), 'Revisión eléctrica', 'El cliente canceló por viaje', 'CANCELADA'
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN users r ON r.username = 'recepcion'
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a WHERE a.vehicle_id = v.id AND a.reason = t.reason
);

-- Órdenes de servicio: dos recibidas (una sin mecánico) y una por cada uno de los demás estados.
-- El kilometraje de entrada es el que ya tiene registrado el vehículo.
INSERT INTO service_orders
  (appointment_id, client_id, vehicle_id, mechanic_id, entry_mileage, reported_problem,
   diagnosis, notes, recommendations, status, created_by, delivered_at, created_at)
SELECT a.id, v.client_id, v.id, m.id, v.current_mileage, t.problem,
       t.diagnosis, t.notes, t.recommendations, t.status, r.id, t.delivered_at, t.created_at
FROM (
  SELECT 'PRD482A' AS plate, CAST(NULL AS CHAR) AS mecanico, 'Ruido al frenar' AS problem,
         CAST(NULL AS CHAR) AS diagnosis, CAST(NULL AS CHAR) AS notes, CAST(NULL AS CHAR) AS recommendations,
         'RECIBIDO' AS status, CAST(NULL AS DATETIME) AS delivered_at,
         DATE_SUB(NOW(), INTERVAL 2 HOUR) AS created_at, CAST(NULL AS CHAR) AS cita_motivo
  UNION ALL SELECT 'RTY195B', 'mecanico', 'Revisión de 20,000 km',
         CAST(NULL AS CHAR), CAST(NULL AS CHAR), CAST(NULL AS CHAR),
         'RECIBIDO', CAST(NULL AS DATETIME), DATE_SUB(NOW(), INTERVAL 1 HOUR), CAST(NULL AS CHAR)
  UNION ALL SELECT 'LMN304C', 'mecanico', 'Motor con vibración al ralentí',
         'Posible falla en bujías o en el sistema de encendido', CAST(NULL AS CHAR), CAST(NULL AS CHAR),
         'DIAGNOSTICO', CAST(NULL AS DATETIME), DATE_SUB(NOW(), INTERVAL 1 DAY), CAST(NULL AS CHAR)
  UNION ALL SELECT 'XCV620F', 'mecanico', 'Falla en la suspensión',
         'Amortiguadores delanteros vencidos y bujes desgastados', 'Se detectó desgaste en las llantas delanteras', CAST(NULL AS CHAR),
         'EN_REPARACION', CAST(NULL AS DATETIME), DATE_SUB(NOW(), INTERVAL 2 DAY), 'Falla en la suspensión'
  UNION ALL SELECT 'KLP558E', 'mecanico', 'Calentamiento del motor',
         'Termostato dañado', 'Se espera la llegada del termostato', CAST(NULL AS CHAR),
         'ESPERANDO_REFACCION', CAST(NULL AS DATETIME), DATE_SUB(NOW(), INTERVAL 3 DAY), CAST(NULL AS CHAR)
  UNION ALL SELECT 'GHJ771D', 'mecanico', 'Cambio de aceite y filtros',
         'Mantenimiento preventivo vencido', 'Sin fugas visibles', 'Revisar las llantas traseras en el próximo servicio',
         'TERMINADO', CAST(NULL AS DATETIME), DATE_SUB(NOW(), INTERVAL 4 DAY), CAST(NULL AS CHAR)
  UNION ALL SELECT 'ASD836J', 'mecanico', 'Cambio de aceite',
         'Mantenimiento preventivo', 'Vehículo en buen estado general', 'Revisar los frenos en el próximo servicio',
         'ENTREGADO', DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 6 DAY), 'Cambio de aceite programado'
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN users r ON r.username = 'recepcion'
LEFT JOIN users m ON m.username = t.mecanico
LEFT JOIN appointments a ON a.vehicle_id = v.id AND a.reason = t.cita_motivo
WHERE NOT EXISTS (
  SELECT 1 FROM service_orders o WHERE o.vehicle_id = v.id AND o.reported_problem = t.problem
);

-- Folio legible de las órdenes que aún no lo tienen.
UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL;

-- Historial de estados coherente con el estado actual de cada orden de ejemplo.
INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, created_at)
SELECT o.id, p.from_status, p.to_status,
       IF(p.to_status IN ('RECIBIDO', 'ENTREGADO'), r.id, COALESCE(o.mechanic_id, r.id)),
       DATE_ADD(o.created_at, INTERVAL p.minutos MINUTE)
FROM service_orders o
JOIN users r ON r.username = 'recepcion'
JOIN (
  SELECT 1 AS paso, CAST(NULL AS CHAR) AS from_status, 'RECIBIDO' AS to_status, 0 AS minutos
  UNION ALL SELECT 2, 'RECIBIDO', 'DIAGNOSTICO', 30
  UNION ALL SELECT 3, 'DIAGNOSTICO', 'EN_REPARACION', 120
  UNION ALL SELECT 4, 'EN_REPARACION', 'ESPERANDO_REFACCION', 240
  UNION ALL SELECT 5, 'EN_REPARACION', 'TERMINADO', 300
  UNION ALL SELECT 6, 'TERMINADO', 'ENTREGADO', 360
) p ON (
     (o.status = 'RECIBIDO' AND p.paso IN (1))
  OR (o.status = 'DIAGNOSTICO' AND p.paso IN (1, 2))
  OR (o.status = 'EN_REPARACION' AND p.paso IN (1, 2, 3))
  OR (o.status = 'ESPERANDO_REFACCION' AND p.paso IN (1, 2, 3, 4))
  OR (o.status = 'TERMINADO' AND p.paso IN (1, 2, 3, 5))
  OR (o.status = 'ENTREGADO' AND p.paso IN (1, 2, 3, 5, 6))
)
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id);

-- Servicios realizados.
INSERT INTO order_services (order_id, description, amount)
SELECT o.id, t.description, t.amount
FROM (
  SELECT 'LMN304C' AS plate, 'Motor con vibración al ralentí' AS problem, 'Escaneo computarizado' AS description, 450.00 AS amount
  UNION ALL SELECT 'XCV620F', 'Falla en la suspensión', 'Cambio de amortiguadores delanteros', 3200.00
  UNION ALL SELECT 'XCV620F', 'Falla en la suspensión', 'Reemplazo de bujes de suspensión', 640.00
  UNION ALL SELECT 'KLP558E', 'Calentamiento del motor', 'Diagnóstico del sistema de enfriamiento', 350.00
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 'Aceite sintético 5W-30', 850.00
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 'Filtro de aceite', 180.00
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'Aceite semisintético 10W-40', 650.00
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'Filtro de aire', 220.00
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
WHERE NOT EXISTS (
  SELECT 1 FROM order_services s WHERE s.order_id = o.id AND s.description = t.description
);

-- Mano de obra (el importe lo calcula la base de datos: horas por tarifa).
INSERT INTO order_labor (order_id, description, hours, hourly_rate)
SELECT o.id, t.description, t.hours, t.hourly_rate
FROM (
  SELECT 'XCV620F' AS plate, 'Falla en la suspensión' AS problem, 'Instalación de amortiguadores y bujes' AS description, 3.00 AS hours, 350.00 AS hourly_rate
  UNION ALL SELECT 'KLP558E', 'Calentamiento del motor', 'Revisión del circuito de enfriamiento', 1.50, 350.00
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 'Servicio de cambio de aceite', 1.00, 300.00
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'Servicio menor', 1.00, 300.00
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
WHERE NOT EXISTS (
  SELECT 1 FROM order_labor l WHERE l.order_id = o.id AND l.description = t.description
);
