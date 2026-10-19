-- Migración 002 (Sprint 2): citas, órdenes de servicio, servicios, mano de obra e historial de estados.
-- Las migraciones aplicadas son inmutables: los cambios de esquema van en scripts nuevos.
-- Ninguna llave foránea es en cascada: las citas y las órdenes se cancelan, no se eliminan.

CREATE TABLE appointments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  clientId    INT UNSIGNED NOT NULL,
  vehicleId   INT UNSIGNED NOT NULL,
  scheduledAt DATETIME     NOT NULL,
  reason      VARCHAR(255) NOT NULL,
  notes       TEXT         NULL,
  status      ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  createdBy   INT UNSIGNED NOT NULL,
  createdAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_scheduled (scheduledAt),
  KEY idx_appointments_status (status),
  KEY idx_appointments_client (clientId),
  KEY idx_appointments_vehicle (vehicleId, scheduledAt),
  CONSTRAINT fk_appointments_client  FOREIGN KEY (clientId)  REFERENCES clients  (id),
  CONSTRAINT fk_appointments_vehicle FOREIGN KEY (vehicleId) REFERENCES vehicles (id),
  CONSTRAINT fk_appointments_user    FOREIGN KEY (createdBy) REFERENCES users    (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_orders (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio              VARCHAR(20)  NULL,
  appointmentId      INT UNSIGNED NULL,
  clientId           INT UNSIGNED NOT NULL,
  vehicleId          INT UNSIGNED NOT NULL,
  mechanicId         INT UNSIGNED NOT NULL,
  entryMileage       INT UNSIGNED NOT NULL,
  reportedProblem    TEXT         NOT NULL,
  diagnosis          TEXT         NULL,
  notes              TEXT         NULL,
  recommendations    TEXT         NULL,
  status             ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA')
                     NOT NULL DEFAULT 'RECIBIDO',
  cancellationReason VARCHAR(255) NULL,
  total              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  deliveredAt        DATETIME     NULL,
  createdBy          INT UNSIGNED NOT NULL,
  createdAt          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_orders_folio (folio),
  KEY idx_service_orders_appointment (appointmentId),
  KEY idx_service_orders_vehicle (vehicleId),
  KEY idx_service_orders_mechanic (mechanicId),
  KEY idx_service_orders_status (status),
  KEY idx_service_orders_created (createdAt),
  CONSTRAINT fk_service_orders_appointment FOREIGN KEY (appointmentId) REFERENCES appointments (id),
  CONSTRAINT fk_service_orders_client      FOREIGN KEY (clientId)      REFERENCES clients      (id),
  CONSTRAINT fk_service_orders_vehicle     FOREIGN KEY (vehicleId)     REFERENCES vehicles     (id),
  CONSTRAINT fk_service_orders_mechanic    FOREIGN KEY (mechanicId)    REFERENCES users        (id),
  CONSTRAINT fk_service_orders_user        FOREIGN KEY (createdBy)     REFERENCES users        (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_services (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  orderId     INT UNSIGNED  NOT NULL,
  description VARCHAR(255)  NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_services_order (orderId),
  CONSTRAINT fk_order_services_order FOREIGN KEY (orderId) REFERENCES service_orders (id),
  CONSTRAINT chk_order_services_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_labor (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  orderId     INT UNSIGNED  NOT NULL,
  description VARCHAR(255)  NOT NULL,
  hours       DECIMAL(5,2)  NOT NULL,
  hourlyRate  DECIMAL(10,2) NOT NULL,
  amount      DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(hours * hourlyRate, 2)) STORED,
  createdAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_labor_order (orderId),
  CONSTRAINT fk_order_labor_order FOREIGN KEY (orderId) REFERENCES service_orders (id),
  CONSTRAINT chk_order_labor_hours CHECK (hours > 0),
  CONSTRAINT chk_order_labor_rate  CHECK (hourlyRate >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_status_history (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  orderId    INT UNSIGNED NOT NULL,
  fromStatus VARCHAR(20)  NULL,
  toStatus   VARCHAR(20)  NOT NULL,
  changedBy  INT UNSIGNED NOT NULL,
  reason     VARCHAR(255) NULL,
  changedAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_status_history_order (orderId, changedAt),
  CONSTRAINT fk_order_status_history_order FOREIGN KEY (orderId)   REFERENCES service_orders (id),
  CONSTRAINT fk_order_status_history_user  FOREIGN KEY (changedBy) REFERENCES users          (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
