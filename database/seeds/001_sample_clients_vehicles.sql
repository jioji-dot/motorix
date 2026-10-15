-- Seed 001 (Sprint 1): clientes y vehículos de ejemplo.
-- Es idempotente: se puede ejecutar varias veces sin duplicar registros ni romper referencias.
--   * Clientes: solo se insertan si no existe uno con el mismo nombre y teléfono.
--   * Vehículos: se identifican por su placa (única); si ya existe se deja como está.
-- Los usuarios iniciales (admin, recepcion, mecanico) los crea server/scripts/seed.js porque
-- sus contraseñas se cifran con bcrypt y no deben guardarse en el repositorio.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO clients (name, phone, email, address)
SELECT t.name, t.phone, t.email, t.address
FROM (
  SELECT 'Ana Pérez Morales' AS name, '5511223344' AS phone, 'ana.perez@correo.mx' AS email, 'Av. Reforma 120, Col. Centro' AS address
  UNION ALL SELECT 'Luis Gómez Herrera', '5522334455', 'luis.gomez@correo.mx', 'Calle Morelos 87, Col. Juárez'
  UNION ALL SELECT 'María López Sánchez', '5533445566', NULL, 'Calle Hidalgo 45, Col. Roma'
  UNION ALL SELECT 'Carlos Ramírez Ortega', '5544556677', 'carlos.ramirez@correo.mx', NULL
  UNION ALL SELECT 'Sofía Hernández Ruiz', '5555667788', NULL, NULL
  UNION ALL SELECT 'Jorge Martínez Cruz', '5566778899', 'jorge.martinez@correo.mx', 'Av. Universidad 310, Col. Del Valle'
  UNION ALL SELECT 'Patricia Flores Vega', '5577889900', 'patricia.flores@correo.mx', 'Calle Allende 15, Col. Narvarte'
  UNION ALL SELECT 'Roberto Díaz Castillo', '5588990011', NULL, NULL
) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM clients c WHERE c.name = t.name AND c.phone = t.phone
);

INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, color, current_mileage)
SELECT c.id, t.brand, t.model, t.year, t.license_plate, t.vin, t.color, t.current_mileage
FROM (
  SELECT 'Ana Pérez Morales' AS client_name, '5511223344' AS client_phone, 'Nissan' AS brand, 'Versa' AS model, 2019 AS year, 'PRD482A' AS license_plate, '3N1CN7AP5KL812345' AS vin, 'Blanco' AS color, 48200 AS current_mileage
  UNION ALL SELECT 'Ana Pérez Morales', '5511223344', 'Honda', 'CR-V', 2021, 'RTY195B', NULL, 'Gris', 22150
  UNION ALL SELECT 'Luis Gómez Herrera', '5522334455', 'Toyota', 'Corolla', 2018, 'LMN304C', '2T1BURHE5JC012345', 'Rojo', 67300
  UNION ALL SELECT 'Luis Gómez Herrera', '5522334455', 'Chevrolet', 'Aveo', 2015, 'GHJ771D', NULL, 'Plata', 112400
  UNION ALL SELECT 'María López Sánchez', '5533445566', 'Volkswagen', 'Jetta', 2020, 'KLP558E', '3VWDB7AJ5LM012345', 'Negro', 35800
  UNION ALL SELECT 'Carlos Ramírez Ortega', '5544556677', 'Ford', 'Ranger', 2017, 'XCV620F', '8AFER13N8H6012345', 'Azul', 94500
  UNION ALL SELECT 'Carlos Ramírez Ortega', '5544556677', 'Mazda', '3', 2022, 'BNM913G', 'JM1BPBLM5N1012345', 'Rojo', 12600
  UNION ALL SELECT 'Sofía Hernández Ruiz', '5555667788', 'Kia', 'Rio', 2019, 'QWE247H', NULL, 'Blanco', 53100
  UNION ALL SELECT 'Jorge Martínez Cruz', '5566778899', 'Hyundai', 'Tucson', 2021, 'ASD836J', 'KM8J3CA46MU012345', 'Gris', 28900
  UNION ALL SELECT 'Jorge Martínez Cruz', '5566778899', 'Nissan', 'NP300', 2016, 'ZXC159K', NULL, 'Blanco', 138700
  UNION ALL SELECT 'Patricia Flores Vega', '5577889900', 'Renault', 'Kwid', 2023, 'POI374L', NULL, 'Naranja', 8400
  UNION ALL SELECT 'Patricia Flores Vega', '5577889900', 'Suzuki', 'Swift', 2018, 'UYT682M', 'JS2ZC21S5J5012345', 'Azul', 71200
) AS t
JOIN clients c ON c.name = t.client_name AND c.phone = t.client_phone
ON DUPLICATE KEY UPDATE id = vehicles.id;
