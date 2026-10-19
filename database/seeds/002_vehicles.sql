-- Seed 002 (Sprint 1): vehículos de ejemplo asociados a los clientes del seed 001.
-- Idempotente: las placas son únicas, por eso ON DUPLICATE KEY UPDATE vehicles.id = vehicles.id no duplica ni cambia nada.
-- Luisa Patricia Mendoza Ríos queda sin vehículos a propósito (estado vacío del detalle).
-- Algunos vehículos no tienen VIN (es opcional).

INSERT INTO vehicles (clientId, brand, model, year, licensePlate, vin, currentMileage)
SELECT c.id, d.brand, d.model, d.year, d.licensePlate, d.vin, d.currentMileage
FROM (
  SELECT '5512345601' AS phone, 'Nissan' AS brand, 'Versa' AS model, 2020 AS year, 'ABC-123-A' AS licensePlate, '3N1CN7AP5KL812345' AS vin, 48200 AS currentMileage
  UNION ALL SELECT '5512345601', 'Volkswagen', 'Jetta', 2017, 'DEF-456-B', NULL, 96500
  UNION ALL SELECT '5512345602', 'Mazda', 'Mazda 3', 2021, 'GHI-789-C', '3MZBN1V73MM123456', 31250
  UNION ALL SELECT '5512345603', 'Chevrolet', 'Aveo', 2015, 'JKL-012-D', NULL, 132800
  UNION ALL SELECT '5512345605', 'Nissan', 'Tsuru', 2016, 'TAX-001-A', NULL, 210400
  UNION ALL SELECT '5512345605', 'Nissan', 'Versa', 2019, 'TAX-002-A', '3N1CN7AD3KL654321', 158900
  UNION ALL SELECT '5512345605', 'Toyota', 'Avanza', 2018, 'TAX-003-A', NULL, 187300
  UNION ALL SELECT '5512345606', 'Ford', 'Ranger', 2019, 'MNO-345-E', '8AFER13N5K6123456', 74100
) AS d
JOIN clients c ON c.phone = d.phone
ON DUPLICATE KEY UPDATE vehicles.id = vehicles.id;
