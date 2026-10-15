-- Creación de las bases de datos de Motorix y del usuario dedicado de la aplicación.
--
-- Ejecutar UNA sola vez con un usuario administrador de MySQL (por ejemplo root):
--   mysql -u root -p < database/scripts/00_create_database.sql
--
-- IMPORTANTE: reemplaza 'CAMBIAR_CONTRASENA' por una contraseña propia ANTES de ejecutar
-- y escribe esa misma contraseña en DB_PASSWORD dentro de tu archivo .env (nunca la versiones).
-- La aplicación NUNCA debe conectarse como root.

CREATE DATABASE IF NOT EXISTS motorix
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE DATABASE IF NOT EXISTS motorix_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'motorix_app'@'localhost' IDENTIFIED BY 'CAMBIAR_CONTRASENA';

GRANT ALL PRIVILEGES ON motorix.* TO 'motorix_app'@'localhost';
GRANT ALL PRIVILEGES ON motorix_test.* TO 'motorix_app'@'localhost';

FLUSH PRIVILEGES;
