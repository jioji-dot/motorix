-- Seed 001 (Sprint 1): clientes de ejemplo.
-- Idempotente: cada cliente se inserta solo si no existe uno con el mismo nombre y teléfono.
-- (El teléfono no es único en la tabla, por eso no se usa ON DUPLICATE KEY.)

INSERT INTO clients (name, phone, email)
SELECT d.name, d.phone, d.email
FROM (
  SELECT 'Roberto Hernández Cruz' AS name, '5512345601' AS phone, 'roberto.hernandez@correo.mx' AS email
  UNION ALL SELECT 'María Fernanda López Díaz', '5512345602', 'mafer.lopez@correo.mx'
  UNION ALL SELECT 'Carlos Alberto Ramírez Soto', '5512345603', NULL
  UNION ALL SELECT 'Luisa Patricia Mendoza Ríos', '5512345604', 'luisa.mendoza@correo.mx'
  UNION ALL SELECT 'Taxis del Valle S.A. de C.V.', '5512345605', 'flotilla@taxisdelvalle.mx'
  UNION ALL SELECT 'José Manuel Ortega Vega', '5512345606', 'jose.ortega@correo.mx'
) AS d
WHERE NOT EXISTS (
  SELECT 1 FROM clients c WHERE c.name = d.name AND c.phone = d.phone
);
