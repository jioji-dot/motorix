-- Migración 004 (Sprint 4): pagos y tickets de servicio.
-- Las migraciones aplicadas son inmutables: los cambios de esquema van en scripts nuevos.
-- Ninguna llave foránea es en cascada: los pagos y los tickets nunca se eliminan.
-- Por diseño (RN-14) no existen columnas para datos de tarjetas ni para credenciales de pago.

CREATE TABLE payments (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  orderId           INT UNSIGNED  NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  method            ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','MERCADO_PAGO') NOT NULL,
  status            ENUM('PENDIENTE','PAGADO','RECHAZADO','CANCELADO') NOT NULL,
  reference         VARCHAR(100)  NULL,
  externalReference VARCHAR(64)   NULL,
  externalId        VARCHAR(40)   NULL,
  paymentLink       VARCHAR(500)  NULL,
  paidAt            DATETIME      NULL,
  createdBy         INT UNSIGNED  NOT NULL,
  createdAt         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_external_reference (externalReference),
  UNIQUE KEY uq_payments_external_id (externalId),
  KEY idx_payments_order (orderId),
  KEY idx_payments_status (status),
  KEY idx_payments_paid_at (paidAt),
  CONSTRAINT fk_payments_order FOREIGN KEY (orderId)   REFERENCES service_orders (id),
  CONSTRAINT fk_payments_user  FOREIGN KEY (createdBy) REFERENCES users          (id),
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_payments_initial_status CHECK (method = 'MERCADO_PAGO' OR status = 'PAGADO'),
  CONSTRAINT chk_payments_paid_at CHECK (status = 'PAGADO' OR paidAt IS NULL),
  CONSTRAINT chk_payments_external CHECK (
    method = 'MERCADO_PAGO' OR (externalReference IS NULL AND externalId IS NULL AND paymentLink IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tickets (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio       VARCHAR(20)  NOT NULL,
  orderId     INT UNSIGNED NOT NULL,
  paymentId   INT UNSIGNED NULL,
  generatedBy INT UNSIGNED NOT NULL,
  generatedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_folio (folio),
  UNIQUE KEY uq_tickets_order (orderId),
  KEY idx_tickets_payment (paymentId),
  CONSTRAINT fk_tickets_order   FOREIGN KEY (orderId)     REFERENCES service_orders (id),
  CONSTRAINT fk_tickets_payment FOREIGN KEY (paymentId)   REFERENCES payments       (id),
  CONSTRAINT fk_tickets_user    FOREIGN KEY (generatedBy) REFERENCES users          (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
