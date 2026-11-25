-- Migración 006 (Sprint 7): configuración, catálogo de tipos de servicio, términos y condiciones, bitácora e inactividad.
-- Las migraciones aplicadas son inmutables: los cambios de esquema van en scripts nuevos.
-- Es aditiva: no modifica los datos existentes. Ninguna llave foránea es en cascada: los usuarios, los tipos de
-- servicio y las versiones de términos se desactivan o se conservan, nunca se borran.
-- La bitácora solo recibe INSERT desde la aplicación: no hay rutas para editarla ni para borrarla.

-- Configuración clave-valor: datos del taller y márgenes de «Próximo» (los valores de respaldo viven en el código y en .env).
CREATE TABLE settings (
  settingKey   VARCHAR(60)  NOT NULL,
  settingValue VARCHAR(255) NOT NULL,
  updatedBy    INT UNSIGNED NULL,
  updatedAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (settingKey),
  CONSTRAINT fk_settings_user FOREIGN KEY (updatedBy) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogo de tipos de servicio con su intervalo de mantenimiento (RN-12).
CREATE TABLE service_types (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100) NOT NULL,
  intervalDays INT UNSIGNED NULL,
  intervalKm   INT UNSIGNED NULL,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  createdAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_types_name (name),
  CONSTRAINT chk_service_types_interval CHECK (intervalDays IS NOT NULL OR intervalKm IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Enlace opcional de una línea de servicio de una orden con un tipo de servicio (las líneas existentes quedan sin tipo).
ALTER TABLE order_services
  ADD COLUMN serviceTypeId INT UNSIGNED NULL,
  ADD KEY idx_order_services_type (serviceTypeId),
  ADD CONSTRAINT fk_order_services_type FOREIGN KEY (serviceTypeId) REFERENCES service_types (id);

-- Marca de la última actividad del usuario para cerrar la sesión por inactividad.
ALTER TABLE users ADD COLUMN lastActivityAt DATETIME NULL;

-- Instantánea del ticket: datos del taller y próximo servicio al generarse (nulos en los tickets anteriores).
ALTER TABLE tickets
  ADD COLUMN shopName           VARCHAR(120) NULL,
  ADD COLUMN shopAddress        VARCHAR(200) NULL,
  ADD COLUMN shopPhone          VARCHAR(30)  NULL,
  ADD COLUMN nextServiceName    VARCHAR(100) NULL,
  ADD COLUMN nextServiceDate    DATE         NULL,
  ADD COLUMN nextServiceMileage INT UNSIGNED NULL;

-- Versiones de los términos y condiciones y del aviso de privacidad: la vigente es la de mayor número.
CREATE TABLE terms_versions (
  version     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  termsText   TEXT         NOT NULL,
  privacyText TEXT         NOT NULL,
  publishedBy INT UNSIGNED NULL,
  publishedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version),
  CONSTRAINT fk_terms_versions_user FOREIGN KEY (publishedBy) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aceptación de una versión por un usuario (una sola vez por usuario y versión).
CREATE TABLE terms_acceptances (
  userId     INT UNSIGNED NOT NULL,
  version    INT UNSIGNED NOT NULL,
  acceptedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, version),
  CONSTRAINT fk_terms_acceptances_user    FOREIGN KEY (userId)  REFERENCES users          (id),
  CONSTRAINT fk_terms_acceptances_version FOREIGN KEY (version) REFERENCES terms_versions (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bitácora de acciones sensibles. `detail` guarda solo los campos permitidos de cada acción: nunca contraseñas,
-- hashes, tokens ni datos de tarjeta.
CREATE TABLE audit_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId     INT UNSIGNED    NULL,
  actorLabel VARCHAR(120)    NULL,
  action     VARCHAR(40)     NOT NULL,
  entity     VARCHAR(40)     NULL,
  entityId   INT UNSIGNED    NULL,
  detail     JSON            NULL,
  createdAt  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_created (createdAt),
  KEY idx_audit_log_user    (userId, createdAt),
  KEY idx_audit_log_action  (action, createdAt),
  CONSTRAINT fk_audit_log_user FOREIGN KEY (userId) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
