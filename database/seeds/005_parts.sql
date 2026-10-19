-- Seed 005 (Sprint 3): catálogo de refacciones de ejemplo con su existencia inicial y entradas como movimientos.
-- Idempotente: cada refacción se inserta solo si su código no existe y cada movimiento solo si su motivo no está registrado.
-- Al final, `parts.stock` se fija como la suma de sus movimientos, así que la invariante se cumple por construcción.
-- Requiere el usuario `admin` del script npm run seed. Niveles resultantes: una agotada (SEN-O2-01, tras el seed 006),
-- dos en stock bajo (DIS-DEL-01 y BUJ-IR-01) y el resto en orden.

-- 1. Catálogo --------------------------------------------------------------------------------------------------
INSERT INTO parts (code, name, category, brand, stock, minimumStock, purchasePrice, salePrice, active)
SELECT d.code, d.name, d.category, d.brand, 0, d.minimumStock, d.purchasePrice, d.salePrice, 1
FROM (
  SELECT 'ACE-5W30-01' AS code, 'Aceite sintético 5W-30 (1 L)' AS name, 'Aceites y filtros' AS category, 'Mobil' AS brand,
         10 AS minimumStock, 95.00 AS purchasePrice, 150.00 AS salePrice
  UNION ALL SELECT 'FIL-ACE-01', 'Filtro de aceite', 'Aceites y filtros', 'Bosch', 8, 60.00, 110.00
  UNION ALL SELECT 'FIL-AIR-01', 'Filtro de aire', 'Aceites y filtros', 'Bosch', 6, 85.00, 150.00
  UNION ALL SELECT 'BAL-DEL-01', 'Balatas delanteras (juego)', 'Frenos', 'Brembo', 4, 420.00, 690.00
  UNION ALL SELECT 'DIS-DEL-01', 'Disco de freno delantero', 'Frenos', 'Brembo', 4, 780.00, 1250.00
  UNION ALL SELECT 'LIQ-FRE-01', 'Líquido de frenos DOT 4 (500 ml)', 'Frenos', 'Castrol', 5, 70.00, 130.00
  UNION ALL SELECT 'BAT-60-01', 'Batería 12 V 60 Ah', 'Batería', 'LTH', 2, 1450.00, 2100.00
  UNION ALL SELECT 'TER-BAT-01', 'Terminal de batería', 'Batería', 'Genérica', 5, 25.00, 60.00
  UNION ALL SELECT 'AMO-DEL-01', 'Amortiguador delantero', 'Suspensión', 'Monroe', 3, 890.00, 1380.00
  UNION ALL SELECT 'BUJ-IR-01', 'Bujía de iridio', 'Encendido', 'NGK', 8, 120.00, 210.00
  UNION ALL SELECT 'SEN-O2-01', 'Sensor de oxígeno', 'Encendido', 'Denso', 2, 950.00, 1480.00
  UNION ALL SELECT 'BAN-ACC-01', 'Banda de accesorios', 'Motor', 'Gates', 3, 310.00, 520.00
  UNION ALL SELECT 'TEN-BAN-01', 'Tensor de banda', 'Motor', 'Gates', 2, 380.00, 540.00
  UNION ALL SELECT 'EMP-TAP-01', 'Empaque de tapa de punterías', 'Motor', 'Victor Reinz', 2, 140.00, 260.00
) AS d
WHERE NOT EXISTS (SELECT 1 FROM parts p WHERE p.code = d.code);

-- 2. Existencia inicial (incluye las piezas que usarán las órdenes de ejemplo del seed 006) ------------------------
INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, createdBy)
SELECT p.id, 'IN', d.qty, d.qty, 'Existencia inicial', (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (
  SELECT 'ACE-5W30-01' AS code, 30 AS qty
  UNION ALL SELECT 'FIL-ACE-01', 27
  UNION ALL SELECT 'FIL-AIR-01', 18
  UNION ALL SELECT 'BAL-DEL-01', 12
  UNION ALL SELECT 'DIS-DEL-01', 3
  UNION ALL SELECT 'LIQ-FRE-01', 15
  UNION ALL SELECT 'BAT-60-01', 7
  UNION ALL SELECT 'TER-BAT-01', 22
  UNION ALL SELECT 'AMO-DEL-01', 8
  UNION ALL SELECT 'BUJ-IR-01', 2
  UNION ALL SELECT 'SEN-O2-01', 1
  UNION ALL SELECT 'BAN-ACC-01', 8
  UNION ALL SELECT 'TEN-BAN-01', 5
  UNION ALL SELECT 'EMP-TAP-01', 5
) AS d
JOIN parts p ON p.code = d.code
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_movements m WHERE m.partId = p.id AND m.reason = 'Existencia inicial' AND m.orderId IS NULL
);

-- 3. Una entrada de compra y un ajuste por conteo físico, para que los movimientos tengan variedad --------------------
INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, createdBy)
SELECT p.id, 'IN', 10,
       (SELECT COALESCE(SUM(x.quantity), 0) FROM inventory_movements x WHERE x.partId = p.id) + 10,
       'Compra a proveedor (datos de ejemplo)', (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM parts p
WHERE p.code = 'ACE-5W30-01'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m.partId = p.id AND m.reason = 'Compra a proveedor (datos de ejemplo)');

INSERT INTO inventory_movements (partId, type, quantity, stockAfter, reason, createdBy)
SELECT p.id, 'ADJUSTMENT', -2,
       (SELECT COALESCE(SUM(x.quantity), 0) FROM inventory_movements x WHERE x.partId = p.id) - 2,
       'Ajuste por conteo físico (datos de ejemplo)', (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM parts p
WHERE p.code = 'FIL-ACE-01'
  AND NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m.partId = p.id AND m.reason = 'Ajuste por conteo físico (datos de ejemplo)');

-- 4. El stock de cada refacción es la suma de sus movimientos (invariante del inventario) ------------------------------
UPDATE parts p
   SET p.stock = (SELECT COALESCE(SUM(m.quantity), 0) FROM inventory_movements m WHERE m.partId = p.id);
