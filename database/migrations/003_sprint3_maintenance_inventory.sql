-- Migración 003 (Sprint 3): refacciones, movimientos de inventario, refacciones por orden y mantenimientos.
-- Las migraciones aplicadas son inmutables: los cambios de esquema van en scripts nuevos.
-- Ninguna llave foránea es en cascada: los movimientos y las líneas de orden nunca se eliminan.

CREATE TABLE parts (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  code          VARCHAR(40)   NOT NULL,
  name          VARCHAR(120)  NOT NULL,
  category      VARCHAR(60)   NOT NULL,
  brand         VARCHAR(60)   NOT NULL,
  stock         INT UNSIGNED  NOT NULL DEFAULT 0,
  minimumStock  INT UNSIGNED  NOT NULL DEFAULT 0,
  purchasePrice DECIMAL(10,2) NOT NULL,
  salePrice     DECIMAL(10,2) NOT NULL,
  active        TINYINT(1)    NOT NULL DEFAULT 1,
  createdAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parts_code (code),
  KEY idx_parts_name (name),
  KEY idx_parts_category (category),
  KEY idx_parts_active (active),
  CONSTRAINT chk_parts_stock          CHECK (stock >= 0),
  CONSTRAINT chk_parts_purchase_price CHECK (purchasePrice >= 0),
  CONSTRAINT chk_parts_sale_price     CHECK (salePrice >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_movements (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  partId     INT UNSIGNED NOT NULL,
  type       ENUM('IN','OUT','ADJUSTMENT') NOT NULL,
  quantity   INT          NOT NULL,
  stockAfter INT UNSIGNED NOT NULL,
  reason     VARCHAR(255) NOT NULL,
  orderId    INT UNSIGNED NULL,
  createdBy  INT UNSIGNED NOT NULL,
  createdAt  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movements_part (partId, createdAt),
  KEY idx_movements_order (orderId),
  CONSTRAINT fk_movements_part  FOREIGN KEY (partId)    REFERENCES parts          (id),
  CONSTRAINT fk_movements_order FOREIGN KEY (orderId)   REFERENCES service_orders (id),
  CONSTRAINT fk_movements_user  FOREIGN KEY (createdBy) REFERENCES users          (id),
  CONSTRAINT chk_movements_quantity CHECK (quantity <> 0),
  CONSTRAINT chk_movements_type CHECK (
    (type = 'IN' AND quantity > 0) OR (type = 'OUT' AND quantity < 0) OR (type = 'ADJUSTMENT')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_parts (
  id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  orderId   INT UNSIGNED  NOT NULL,
  partId    INT UNSIGNED  NOT NULL,
  partCode  VARCHAR(40)   NOT NULL,
  partName  VARCHAR(120)  NOT NULL,
  quantity  INT UNSIGNED  NOT NULL,
  unitPrice DECIMAL(10,2) NOT NULL,
  amount    DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(quantity * unitPrice, 2)) STORED,
  createdAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_parts_order_part (orderId, partId),
  KEY idx_order_parts_part (partId),
  CONSTRAINT fk_order_parts_order FOREIGN KEY (orderId) REFERENCES service_orders (id),
  CONSTRAINT fk_order_parts_part  FOREIGN KEY (partId)  REFERENCES parts          (id),
  CONSTRAINT chk_order_parts_quantity   CHECK (quantity > 0),
  CONSTRAINT chk_order_parts_unit_price CHECK (unitPrice >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE maintenance (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicleId       INT UNSIGNED NOT NULL,
  serviceType     VARCHAR(100) NOT NULL,
  lastServiceDate DATE         NOT NULL,
  lastMileage     INT UNSIGNED NOT NULL,
  nextDate        DATE         NULL,
  nextMileage     INT UNSIGNED NULL,
  notes           TEXT         NULL,
  status          ENUM('PENDIENTE','ATENDIDO') NOT NULL DEFAULT 'PENDIENTE',
  completedAt     DATETIME     NULL,
  sourceOrderId   INT UNSIGNED NULL,
  createdBy       INT UNSIGNED NOT NULL,
  createdAt       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_maintenance_vehicle (vehicleId),
  KEY idx_maintenance_status (status),
  CONSTRAINT fk_maintenance_vehicle FOREIGN KEY (vehicleId)     REFERENCES vehicles       (id),
  CONSTRAINT fk_maintenance_order   FOREIGN KEY (sourceOrderId) REFERENCES service_orders (id),
  CONSTRAINT fk_maintenance_user    FOREIGN KEY (createdBy)     REFERENCES users          (id),
  CONSTRAINT chk_maintenance_next      CHECK (nextDate IS NOT NULL OR nextMileage IS NOT NULL),
  CONSTRAINT chk_maintenance_next_date CHECK (nextDate IS NULL OR nextDate >= lastServiceDate),
  CONSTRAINT chk_maintenance_next_km   CHECK (nextMileage IS NULL OR nextMileage > lastMileage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kilometraje al que se realizó el servicio (opcional); el historial usa COALESCE(serviceMileage, entryMileage).
ALTER TABLE service_orders ADD COLUMN serviceMileage INT UNSIGNED NULL AFTER entryMileage;
