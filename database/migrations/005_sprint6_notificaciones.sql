-- Migración 005 (Sprint 6): notificaciones internas y clientes por avisar.
-- Las migraciones aplicadas son inmutables: los cambios de esquema van en scripts nuevos.
-- Los avisos NO se guardan: se calculan al consultar. Solo se guarda la lectura de cada usuario
-- y el registro de los avisos que una persona hizo a un cliente.
-- Ninguna llave foránea es en cascada: los usuarios y los clientes se desactivan, no se eliminan.

CREATE TABLE notification_reads (
  userId    INT UNSIGNED NOT NULL,
  noticeKey VARCHAR(60)  NOT NULL,
  readAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (userId, noticeKey),
  CONSTRAINT fk_notification_reads_user FOREIGN KEY (userId) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE client_notices (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  clientId  INT UNSIGNED NOT NULL,
  kind      ENUM('ORDEN_LISTA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO') NOT NULL,
  factId    INT UNSIGNED NOT NULL,
  noticedBy INT UNSIGNED NOT NULL,
  noticedAt DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note      VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_notices_fact (kind, factId),
  KEY idx_client_notices_client (clientId),
  CONSTRAINT fk_client_notices_client FOREIGN KEY (clientId)  REFERENCES clients (id),
  CONSTRAINT fk_client_notices_user   FOREIGN KEY (noticedBy) REFERENCES users   (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
