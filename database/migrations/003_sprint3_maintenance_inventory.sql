-- Migración 003 (Sprint 3): mantenimiento, refacciones e inventario.
-- Esta migración es inmutable: los cambios de esquema se agregan como nuevos scripts numerados.

-- Kilometraje con el que termina el servicio (opcional; US2).
ALTER TABLE service_orders
  ADD COLUMN service_mileage INT UNSIGNED NULL AFTER entry_mileage;

-- Apoya la búsqueda de la fecha en que una orden pasó a TERMINADO (historial del vehículo, US1).
ALTER TABLE order_status_history
  ADD INDEX idx_order_history_order_status (order_id, to_status);

-- Configuración editable con SQL: umbrales de aviso de mantenimiento (RN-12).
CREATE TABLE app_settings (
  setting_key VARCHAR(60) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('maintenance_warning_days', '30'),
  ('maintenance_warning_km', '1000');

CREATE TABLE parts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  minimum_stock INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parts_code (code),
  KEY idx_parts_name (name),
  KEY idx_parts_active_stock (active, stock),
  CONSTRAINT chk_parts_price CHECK (price >= 0),
  CONSTRAINT chk_parts_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Movimientos de solo inserción. `quantity` lleva signo: IN > 0, OUT < 0, ADJUSTMENT <> 0.
-- Invariante: parts.stock = SUM(inventory_movements.quantity) por refacción.
CREATE TABLE inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  part_id INT UNSIGNED NOT NULL,
  type ENUM('IN','OUT','ADJUSTMENT') NOT NULL,
  quantity INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  order_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movements_part_date (part_id, created_at, id),
  KEY idx_movements_order (order_id),
  CONSTRAINT chk_movements_quantity CHECK (quantity <> 0),
  CONSTRAINT chk_movements_type CHECK (
    (type = 'IN' AND quantity > 0)
    OR (type = 'OUT' AND quantity < 0 AND order_id IS NOT NULL)
    OR type = 'ADJUSTMENT'
  ),
  CONSTRAINT fk_movements_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movements_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_movements_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_parts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  part_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_parts_order_part (order_id, part_id),
  KEY idx_order_parts_part (part_id),
  CONSTRAINT chk_order_parts_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_parts_price CHECK (unit_price >= 0),
  CONSTRAINT fk_order_parts_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_parts_part FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Próximo mantenimiento de un vehículo, programado por fecha, por kilometraje o por ambos.
-- `pending_vehicle_id` garantiza un solo mantenimiento PENDIENTE por vehículo.
CREATE TABLE maintenance (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  description VARCHAR(255) NOT NULL,
  next_date DATE NULL,
  next_mileage INT UNSIGNED NULL,
  status ENUM('PENDIENTE','REALIZADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  pending_vehicle_id INT UNSIGNED GENERATED ALWAYS AS (IF(status = 'PENDIENTE', vehicle_id, NULL)) STORED,
  completed_at DATETIME NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_maintenance_pending (pending_vehicle_id),
  KEY idx_maintenance_vehicle (vehicle_id),
  KEY idx_maintenance_status_date (status, next_date),
  CONSTRAINT chk_maintenance_target CHECK (next_date IS NOT NULL OR next_mileage IS NOT NULL),
  CONSTRAINT fk_maintenance_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenance_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
