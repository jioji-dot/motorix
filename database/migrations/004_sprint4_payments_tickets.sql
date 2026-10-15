-- Migración 004 (Sprint 4): pagos y tickets.
-- Esta migración es inmutable: los cambios de esquema se agregan como nuevos scripts numerados.

-- Pagos de una orden. Nunca se eliminan; el importe solo cuenta cuando el estado es APROBADO.
-- Mercado Pago nace PENDIENTE (reserva saldo); efectivo, tarjeta y transferencia nacen APROBADO.
-- No se guardan datos de tarjeta: `reference` es solo una autorización u operación informativa.
CREATE TABLE payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  method ENUM('CASH','CARD','TRANSFER','MERCADO_PAGO') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('PENDIENTE','APROBADO','RECHAZADO','CANCELADO','ANULADO') NOT NULL,
  reference VARCHAR(100) NULL,
  external_reference VARCHAR(80) NULL,
  external_id VARCHAR(40) NULL,
  payment_url VARCHAR(500) NULL,
  pending_mp_order_id INT UNSIGNED GENERATED ALWAYS AS (
    IF(method = 'MERCADO_PAGO' AND status = 'PENDIENTE', order_id, NULL)
  ) STORED,
  void_reason VARCHAR(255) NULL,
  voided_by INT UNSIGNED NULL,
  voided_at DATETIME NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_external_reference (external_reference),
  UNIQUE KEY uq_payments_pending_mp (pending_mp_order_id),
  KEY idx_payments_order_status (order_id, status),
  KEY idx_payments_created (created_at),
  KEY idx_payments_status_method (status, method),
  CONSTRAINT chk_payments_amount CHECK (amount > 0),
  CONSTRAINT chk_payments_voided CHECK (
    status <> 'ANULADO' OR (void_reason IS NOT NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL)
  ),
  CONSTRAINT chk_payments_manual_status CHECK (
    method = 'MERCADO_PAGO' OR status IN ('APROBADO','CANCELADO','ANULADO')
  ),
  CONSTRAINT chk_payments_mp_reference CHECK (method <> 'MERCADO_PAGO' OR external_reference IS NOT NULL),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_voided_by FOREIGN KEY (voided_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Ticket de servicio: uno por orden. Solo guarda el folio; el contenido se arma al consultar.
CREATE TABLE tickets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio VARCHAR(12) NULL,
  order_id INT UNSIGNED NOT NULL,
  generated_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tickets_folio (folio),
  UNIQUE KEY uq_tickets_order (order_id),
  CONSTRAINT fk_tickets_order FOREIGN KEY (order_id) REFERENCES service_orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_tickets_generated_by FOREIGN KEY (generated_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Datos del taller que salen en el ticket (se cambian con SQL).
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('workshop_name', 'Motorix Taller Mecánico'),
  ('workshop_address', 'Av. Principal 123, Ciudad de México'),
  ('workshop_phone', '5555123456');
