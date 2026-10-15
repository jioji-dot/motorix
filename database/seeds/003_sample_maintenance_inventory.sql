-- Seed 003 (Sprint 3): refacciones, inventario, historial y mantenimientos de ejemplo.
-- Es idempotente: se puede ejecutar varias veces sin duplicar registros.
--   * Refacciones: se insertan solo si no existe una con el mismo código.
--   * Movimientos: llevan un motivo que empieza por "Semilla:" y se insertan solo si no existe
--     otro de la misma refacción con ese motivo (las salidas, de la misma refacción y orden).
--   * La existencia de las refacciones se recalcula siempre como la suma de sus movimientos
--     (invariante del inventario), así que volver a ejecutar el seed no la altera.
--   * Órdenes históricas: solo si no existe otra del mismo vehículo y problema reportado.
--   * Líneas de servicios, mano de obra y refacciones: por (orden, descripción) o (orden, refacción).
--   * Mantenimientos: solo si el vehículo no tiene otro con la misma descripción.
-- Requiere las migraciones 001 a 003, los usuarios `admin`, `recepcion` y `mecanico` (los crea
-- server/scripts/seed.js) y los seeds 001 y 002. Las fechas son relativas al momento de la primera carga.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------------------------
-- Refacciones: 14 activas (3 con stock bajo, 2 agotadas) y 1 inactiva. La existencia nace en 0 y
-- se calcula a partir de los movimientos de más abajo.
-- ---------------------------------------------------------------------------------------------
INSERT INTO parts (code, name, description, price, stock, minimum_stock, active)
SELECT t.code, t.name, t.description, t.price, 0, t.minimum_stock, t.active
FROM (
  SELECT 'ACE-5W30' AS code, 'Aceite sintético 5W-30 (1 L)' AS name, 'Aceite sintético para motor de gasolina' AS description, 185.00 AS price, 12 AS minimum_stock, 1 AS active
  UNION ALL SELECT 'ACE-10W40', 'Aceite semisintético 10W-40 (1 L)', 'Aceite semisintético para motor de gasolina', 130.00, 12, 1
  UNION ALL SELECT 'FIL-ACE', 'Filtro de aceite', 'Filtro de aceite universal de rosca', 165.00, 10, 1
  UNION ALL SELECT 'FIL-AIR', 'Filtro de aire', 'Filtro de aire de motor', 220.00, 6, 1
  UNION ALL SELECT 'FIL-COMB', 'Filtro de combustible', 'Filtro de combustible en línea', 310.00, 4, 1
  UNION ALL SELECT 'BAL-DEL', 'Balatas delanteras (juego)', 'Juego de balatas cerámicas delanteras', 780.00, 4, 1
  UNION ALL SELECT 'BAL-TRA', 'Balatas traseras (juego)', 'Juego de balatas cerámicas traseras', 690.00, 4, 1
  UNION ALL SELECT 'DIS-DEL', 'Disco de freno delantero', 'Disco ventilado delantero (pieza)', 1150.00, 2, 1
  UNION ALL SELECT 'BUJ-NGK', 'Bujía de iridio', 'Bujía de iridio (pieza)', 95.00, 16, 1
  UNION ALL SELECT 'AMO-DEL', 'Amortiguador delantero', 'Amortiguador delantero de gas (pieza)', 1650.00, 2, 1
  UNION ALL SELECT 'BUJE-SUS', 'Buje de suspensión', 'Buje de hule de la barra estabilizadora', 320.00, 6, 1
  UNION ALL SELECT 'TERM-90', 'Termostato 90 °C', 'Termostato con empaque', 420.00, 3, 1
  UNION ALL SELECT 'BAT-12V', 'Batería 12 V 45 Ah', 'Batería libre de mantenimiento', 1890.00, 2, 1
  UNION ALL SELECT 'LIQ-ANT', 'Anticongelante (1 L)', 'Líquido refrigerante concentrado', 120.00, 8, 1
  UNION ALL SELECT 'BAN-OLD', 'Banda serpentina (descontinuada)', 'Pieza descontinuada por el proveedor', 260.00, 2, 0
) AS t
WHERE NOT EXISTS (SELECT 1 FROM parts p WHERE p.code = t.code);

-- ---------------------------------------------------------------------------------------------
-- Órdenes históricas: tres servicios entregados al Nissan Versa PRD482A (historial con varios
-- servicios y kilometraje de servicio) y uno al Nissan NP300 y al Honda CR-V para los avisos.
-- ---------------------------------------------------------------------------------------------
INSERT INTO service_orders
  (appointment_id, client_id, vehicle_id, mechanic_id, entry_mileage, service_mileage, reported_problem,
   diagnosis, notes, recommendations, status, created_by, delivered_at, created_at)
SELECT NULL, v.client_id, v.id, m.id, t.entry_mileage, t.service_mileage, t.problem,
       t.diagnosis, NULL, t.recommendations, 'ENTREGADO', r.id,
       DATE_ADD(DATE_SUB(NOW(), INTERVAL t.days DAY), INTERVAL 6 HOUR),
       DATE_SUB(NOW(), INTERVAL t.days DAY)
FROM (
  SELECT 'PRD482A' AS plate, 200 AS days, 40100 AS entry_mileage, 40250 AS service_mileage,
         'Cambio de aceite y filtro (servicio de 40,000 km)' AS problem,
         'Aceite degradado; sin fugas' AS diagnosis,
         'Cambiar el aceite cada 5,000 km' AS recommendations
  UNION ALL SELECT 'PRD482A', 120, 44300, 44420,
         'Revisión de frenos y cambio de balatas delanteras',
         'Balatas y discos delanteros desgastados',
         'Revisar las balatas traseras en el próximo servicio'
  UNION ALL SELECT 'PRD482A', 50, 47000, 47150,
         'Afinación mayor',
         'Bujías agotadas y termostato con falla',
         'Programar el siguiente cambio de aceite'
  UNION ALL SELECT 'ZXC159K', 30, 138650, 138700,
         'Cambio de banda y revisión general',
         'Banda de accesorios agrietada',
         'Revisar los amortiguadores traseros'
  UNION ALL SELECT 'RTY195B', 15, 21900, 22000,
         'Servicio de 20,000 km',
         'Vehículo en buen estado general',
         'Siguiente servicio a los 30,000 km'
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN users r ON r.username = 'recepcion'
JOIN users m ON m.username = 'mecanico'
WHERE NOT EXISTS (
  SELECT 1 FROM service_orders o WHERE o.vehicle_id = v.id AND o.reported_problem = t.problem
);

-- Folio legible de las órdenes que aún no lo tienen.
UPDATE service_orders SET folio = CONCAT('OS-', LPAD(id, 6, '0')) WHERE folio IS NULL;

-- Historial de estados de las órdenes que aún no tienen ninguno (todas las nuevas están entregadas).
INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, created_at)
SELECT o.id, p.from_status, p.to_status,
       IF(p.to_status IN ('RECIBIDO', 'ENTREGADO'), r.id, COALESCE(o.mechanic_id, r.id)),
       DATE_ADD(o.created_at, INTERVAL p.minutos MINUTE)
FROM service_orders o
JOIN users r ON r.username = 'recepcion'
JOIN (
  SELECT 'RECIBIDO' AS paso_estado, CAST(NULL AS CHAR) AS from_status, 'RECIBIDO' AS to_status, 0 AS minutos
  UNION ALL SELECT 'DIAGNOSTICO', 'RECIBIDO', 'DIAGNOSTICO', 30
  UNION ALL SELECT 'EN_REPARACION', 'DIAGNOSTICO', 'EN_REPARACION', 120
  UNION ALL SELECT 'TERMINADO', 'EN_REPARACION', 'TERMINADO', 300
  UNION ALL SELECT 'ENTREGADO', 'TERMINADO', 'ENTREGADO', 360
) p ON o.status = 'ENTREGADO'
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id);

-- Servicios realizados de las órdenes históricas.
INSERT INTO order_services (order_id, description, amount)
SELECT o.id, t.description, t.amount
FROM (
  SELECT 'PRD482A' AS plate, 'Cambio de aceite y filtro (servicio de 40,000 km)' AS problem, 'Aceite sintético 5W-30' AS description, 740.00 AS amount
  UNION ALL SELECT 'PRD482A', 'Cambio de aceite y filtro (servicio de 40,000 km)', 'Filtro de aceite', 165.00
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 'Cambio de balatas delanteras', 620.00
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 'Cambio de discos delanteros', 480.00
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'Afinación mayor del motor', 450.00
  UNION ALL SELECT 'ZXC159K', 'Cambio de banda y revisión general', 'Cambio de banda de accesorios', 520.00
  UNION ALL SELECT 'ZXC159K', 'Cambio de banda y revisión general', 'Revisión general de 30 puntos', 350.00
  UNION ALL SELECT 'RTY195B', 'Servicio de 20,000 km', 'Servicio menor de 20,000 km', 890.00
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
WHERE NOT EXISTS (
  SELECT 1 FROM order_services s WHERE s.order_id = o.id AND s.description = t.description
);

-- Mano de obra de las órdenes históricas (el importe lo calcula la base de datos).
INSERT INTO order_labor (order_id, description, hours, hourly_rate)
SELECT o.id, t.description, t.hours, t.hourly_rate
FROM (
  SELECT 'PRD482A' AS plate, 'Cambio de aceite y filtro (servicio de 40,000 km)' AS problem, 'Servicio de cambio de aceite' AS description, 1.00 AS hours, 300.00 AS hourly_rate
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 'Revisión y cambio de frenos delanteros', 2.00, 350.00
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'Afinación y cambio de termostato', 2.50, 350.00
  UNION ALL SELECT 'ZXC159K', 'Cambio de banda y revisión general', 'Cambio de banda y revisión', 1.50, 350.00
  UNION ALL SELECT 'RTY195B', 'Servicio de 20,000 km', 'Servicio menor', 1.00, 300.00
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
WHERE NOT EXISTS (
  SELECT 1 FROM order_labor l WHERE l.order_id = o.id AND l.description = t.description
);

-- ---------------------------------------------------------------------------------------------
-- Refacciones usadas en las órdenes (históricas y de los estados de trabajo del seed 002).
-- El precio unitario es el vigente de la refacción al cargar el seed.
-- ---------------------------------------------------------------------------------------------
INSERT INTO order_parts (order_id, part_id, quantity, unit_price)
SELECT o.id, p.id, t.quantity, p.price
FROM (
  SELECT 'PRD482A' AS plate, 'Cambio de aceite y filtro (servicio de 40,000 km)' AS problem, 'ACE-5W30' AS code, 4 AS quantity
  UNION ALL SELECT 'PRD482A', 'Cambio de aceite y filtro (servicio de 40,000 km)', 'FIL-ACE', 1
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 'BAL-DEL', 1
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 'DIS-DEL', 2
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'BUJ-NGK', 4
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'FIL-AIR', 1
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'FIL-COMB', 1
  UNION ALL SELECT 'PRD482A', 'Afinación mayor', 'TERM-90', 1
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 'ACE-5W30', 4
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 'FIL-ACE', 1
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'ACE-10W40', 4
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'FIL-AIR', 1
  UNION ALL SELECT 'XCV620F', 'Falla en la suspensión', 'AMO-DEL', 2
  UNION ALL SELECT 'XCV620F', 'Falla en la suspensión', 'BUJE-SUS', 4
  UNION ALL SELECT 'KLP558E', 'Calentamiento del motor', 'LIQ-ANT', 2
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
JOIN parts p ON p.code = t.code
WHERE NOT EXISTS (
  SELECT 1 FROM order_parts op WHERE op.order_id = o.id AND op.part_id = p.id
);

-- ---------------------------------------------------------------------------------------------
-- Movimientos de inventario: entradas (existencia inicial y compras), ajustes por conteo físico y
-- una salida por cada refacción usada en una orden.
-- ---------------------------------------------------------------------------------------------
INSERT INTO inventory_movements (part_id, type, quantity, reason, order_id, created_by, created_at)
SELECT p.id, t.type, t.quantity, t.reason, NULL, u.id, DATE_SUB(NOW(), INTERVAL t.days DAY)
FROM (
  SELECT 'ACE-5W30' AS code, 'IN' AS type, 38 AS quantity, 'Semilla: existencia inicial' AS reason, 230 AS days
  UNION ALL SELECT 'ACE-5W30', 'IN', 10, 'Semilla: compra a proveedor', 40
  UNION ALL SELECT 'ACE-10W40', 'IN', 12, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'FIL-ACE', 'IN', 27, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'FIL-AIR', 'IN', 16, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'FIL-COMB', 'IN', 5, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BAL-DEL', 'IN', 5, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BAL-DEL', 'IN', 5, 'Semilla: compra a proveedor', 60
  UNION ALL SELECT 'BAL-TRA', 'IN', 6, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BAL-TRA', 'ADJUSTMENT', -3, 'Semilla: ajuste por conteo físico (piezas dañadas)', 20
  UNION ALL SELECT 'DIS-DEL', 'IN', 2, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BUJ-NGK', 'IN', 36, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'AMO-DEL', 'IN', 6, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BUJE-SUS', 'IN', 16, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'TERM-90', 'IN', 1, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BAT-12V', 'IN', 6, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BAT-12V', 'ADJUSTMENT', -2, 'Semilla: ajuste por conteo físico (devolución a proveedor)', 10
  UNION ALL SELECT 'LIQ-ANT', 'IN', 22, 'Semilla: existencia inicial', 230
  UNION ALL SELECT 'BAN-OLD', 'IN', 3, 'Semilla: existencia inicial', 230
) AS t
JOIN parts p ON p.code = t.code
JOIN users u ON u.username = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_movements m WHERE m.part_id = p.id AND m.reason = t.reason
);

-- Una salida por cada refacción de las órdenes de ejemplo, ligada a la orden.
INSERT INTO inventory_movements (part_id, type, quantity, reason, order_id, created_by, created_at)
SELECT op.part_id, 'OUT', -op.quantity, CONCAT('Semilla: uso en la orden ', o.folio), o.id, m.id,
       DATE_ADD(o.created_at, INTERVAL 3 HOUR)
FROM order_parts op
JOIN service_orders o ON o.id = op.order_id
JOIN users m ON m.username = 'mecanico'
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_movements x WHERE x.order_id = op.order_id AND x.part_id = op.part_id
);

-- Existencia = suma de los movimientos (invariante del inventario).
UPDATE parts p
SET p.stock = (SELECT COALESCE(SUM(m.quantity), 0) FROM inventory_movements m WHERE m.part_id = p.id)
WHERE p.code IN (
  'ACE-5W30', 'ACE-10W40', 'FIL-ACE', 'FIL-AIR', 'FIL-COMB', 'BAL-DEL', 'BAL-TRA', 'DIS-DEL',
  'BUJ-NGK', 'AMO-DEL', 'BUJE-SUS', 'TERM-90', 'BAT-12V', 'LIQ-ANT', 'BAN-OLD'
);

-- ---------------------------------------------------------------------------------------------
-- Mantenimientos: 2 vencidos (uno por kilometraje y otro por fecha), 2 próximos (uno por fecha y
-- otro por kilometraje), 1 lejano, y 1 realizado y 1 cancelado como antecedente. Un vehículo tiene
-- a lo sumo un mantenimiento pendiente.
-- ---------------------------------------------------------------------------------------------
INSERT INTO maintenance (vehicle_id, order_id, description, next_date, next_mileage, status, completed_at, created_by, created_at)
SELECT v.id, o.id, t.description, t.next_date, t.next_mileage, t.status, t.completed_at, m.id,
       DATE_ADD(o.created_at, INTERVAL 7 HOUR)
FROM (
  -- Vencido por kilometraje: el vehículo ya va en 48,200 km.
  SELECT 'PRD482A' AS plate, 'Afinación mayor' AS problem, 'Cambio de aceite y filtro' AS description,
         CAST(NULL AS DATE) AS next_date, 48000 AS next_mileage, 'PENDIENTE' AS status, CAST(NULL AS DATETIME) AS completed_at
  -- Vencido por fecha.
  UNION ALL SELECT 'GHJ771D', 'Cambio de aceite y filtros', 'Cambio de aceite y filtros (siguiente servicio)',
         DATE_SUB(CURDATE(), INTERVAL 10 DAY), CAST(NULL AS SIGNED), 'PENDIENTE', NULL
  -- Próximo por fecha.
  UNION ALL SELECT 'ASD836J', 'Cambio de aceite', 'Revisión de frenos',
         DATE_ADD(CURDATE(), INTERVAL 12 DAY), CAST(NULL AS SIGNED), 'PENDIENTE', NULL
  -- Próximo por kilometraje: el vehículo va en 138,700 km.
  UNION ALL SELECT 'ZXC159K', 'Cambio de banda y revisión general', 'Revisión de amortiguadores traseros',
         CAST(NULL AS DATE), 139500, 'PENDIENTE', NULL
  -- Lejano.
  UNION ALL SELECT 'RTY195B', 'Servicio de 20,000 km', 'Servicio de 30,000 km',
         DATE_ADD(CURDATE(), INTERVAL 150 DAY), 32000, 'PENDIENTE', NULL
  -- Antecedentes del Versa PRD482A.
  UNION ALL SELECT 'PRD482A', 'Cambio de aceite y filtro (servicio de 40,000 km)', 'Cambio de aceite y filtro (45,000 km)',
         CAST(NULL AS DATE), 45000, 'REALIZADO', DATE_SUB(NOW(), INTERVAL 125 DAY)
  UNION ALL SELECT 'PRD482A', 'Revisión de frenos y cambio de balatas delanteras', 'Revisión de balatas traseras',
         DATE_SUB(CURDATE(), INTERVAL 60 DAY), CAST(NULL AS SIGNED), 'CANCELADO', DATE_SUB(NOW(), INTERVAL 55 DAY)
) AS t
JOIN vehicles v ON v.license_plate = t.plate
JOIN service_orders o ON o.vehicle_id = v.id AND o.reported_problem = t.problem
JOIN users m ON m.username = 'mecanico'
WHERE NOT EXISTS (
  SELECT 1 FROM maintenance mt WHERE mt.vehicle_id = v.id AND mt.description = t.description
);
