-- Migración 001 (Sprint 1): usuarios, clientes y vehículos.
-- Las migraciones aplicadas son inmutables: los cambios de esquema van en scripts nuevos.

CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(50)  NOT NULL,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  passwordHash   VARCHAR(100) NOT NULL,
  role           ENUM('ADMIN','RECEPTIONIST','MECHANIC') NOT NULL,
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  failedAttempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  lockedUntil    DATETIME     NULL,
  createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE clients (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name      VARCHAR(120) NOT NULL,
  phone     VARCHAR(20)  NOT NULL,
  email     VARCHAR(120) NULL,
  active    TINYINT(1)   NOT NULL DEFAULT 1,
  createdAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_clients_phone (phone),
  KEY idx_clients_name (name),
  KEY idx_clients_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vehicles (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  clientId       INT UNSIGNED NOT NULL,
  brand          VARCHAR(60)  NOT NULL,
  model          VARCHAR(60)  NOT NULL,
  year           SMALLINT UNSIGNED NOT NULL,
  licensePlate   VARCHAR(15)  NOT NULL,
  vin            VARCHAR(17)  NULL,
  currentMileage INT UNSIGNED NOT NULL DEFAULT 0,
  createdAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_license_plate (licensePlate),
  UNIQUE KEY uq_vehicles_vin (vin),
  KEY idx_vehicles_client (clientId),
  CONSTRAINT fk_vehicles_client FOREIGN KEY (clientId) REFERENCES clients (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
