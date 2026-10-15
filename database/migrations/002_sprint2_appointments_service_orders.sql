-- Migración 002 (Sprint 2): citas y órdenes de servicio.
-- Esta migración es inmutable: los cambios de esquema se agregan como nuevos scripts numerados.

CREATE TABLE appointments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id INT UNSIGNED NOT NULL,
  vehicle_id INT UNSIGNED NOT NULL,
  scheduled_at DATETIME NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes VARCHAR(500) NULL,
  status ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_scheduled (scheduled_at),
  KEY idx_appointments_status (status),
  KEY idx_appointments_client (client_id),
  KEY idx_appointments_vehicle_day (vehicle_id, scheduled_at),
  CONSTRAINT fk_appointments_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE service_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio VARCHAR(12) NULL,
  appointment_id INT UNSIGNED NULL,
  client_id INT UNSIGNED NOT NULL,
  vehicle_id INT UNSIGNED NOT NULL,
  mechanic_id INT UNSIGNED NULL,
  entry_mileage INT UNSIGNED NOT NULL,
  reported_problem VARCHAR(1000) NOT NULL,
  diagnosis TEXT NULL,
  notes TEXT NULL,
  recommendations TEXT NULL,
  status ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO') NOT NULL DEFAULT 'RECIBIDO',
  created_by INT UNSIGNED NOT NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_folio (folio),
  UNIQUE KEY uq_orders_appointment (appointment_id),
  KEY idx_orders_mechanic_status (mechanic_id, status),
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at),
  KEY idx_orders_client (client_id),
  KEY idx_orders_vehicle (vehicle_id),
  CONSTRAINT fk_orders_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_mechanic FOREIGN KEY (mechanic_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_services (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_services_order (order_id),
  CONSTRAINT chk_order_services_amount CHECK (amount >= 0),
  CONSTRAINT fk_order_services_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_labor (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  hours DECIMAL(6,2) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(hours * hourly_rate, 2)) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_labor_order (order_id),
  CONSTRAINT chk_order_labor_hours CHECK (hours > 0),
  CONSTRAINT chk_order_labor_rate CHECK (hourly_rate >= 0),
  CONSTRAINT fk_order_labor_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  from_status ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO') NULL,
  to_status ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO') NOT NULL,
  changed_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_history_order (order_id),
  CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_history_user FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
