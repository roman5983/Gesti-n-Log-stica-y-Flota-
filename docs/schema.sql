-- ============================================================================
-- Logistics & Fleet Management System (TP DSW)
-- Database creation script — MySQL Server 8.0.16+
-- Source: approved definitive ERD (Stage 2), translated to English per
-- project directive (all code and documents in English).
--
-- Operational note: from Stage 3 onwards the model is mirrored in
-- prisma/schema.prisma, which becomes the operational source of migrations.
-- This script is the reference DDL for the relational model.
-- Spanish → English mapping: usuario→users, chofer→drivers,
-- documentacion→driver_documents, vehiculo→vehicles,
-- tipo_mantenimiento→maintenance_types, mantenimiento→maintenances,
-- viaje→trips, alerta→alerts, auditoria→audit_logs,
-- configuracion→company_settings.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS logistics_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE logistics_management;

-- ----------------------------------------------------------------------------
-- 1. users — base of the specialization (role as discriminator)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(60)  NOT NULL COMMENT 'bcrypt',
  role          ENUM('ADMIN','OPERATOR','DRIVER') NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  deleted_at    DATETIME     NULL COMMENT 'soft delete (RN-20); NULL = active record',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. refresh_tokens — JWT session revocation (P-C)
-- ----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64)     NOT NULL COMMENT 'SHA-256 of the token; never stored in plain text',
  expires_at DATETIME     NOT NULL,
  revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. drivers — 1:1 subtype of users (shared PK)
-- ----------------------------------------------------------------------------
CREATE TABLE drivers (
  user_id             INT UNSIGNED  NOT NULL,
  dni                 VARCHAR(10)   NOT NULL,
  license_category    ENUM('A','B','C','E') NOT NULL COMMENT 'driver attribute (C-2)',
  license_expiry_date DATE          NOT NULL COMMENT 'basis of RN-1/RN-19 and A-12 alerts',
  encrypted_password  VARCHAR(255)  NOT NULL COMMENT 'AES-256-GCM; visible to Admin only (A-9)',
  completed_trips     INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT 'denormalized; updated on trip completion (RN-11)',
  avg_km              DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_drivers_dni (dni),
  KEY idx_drivers_license_expiry (license_expiry_date),
  CONSTRAINT fk_drivers_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. driver_documents — driver documentation (F-4, F-9)
-- ----------------------------------------------------------------------------
CREATE TABLE driver_documents (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  driver_id     INT UNSIGNED NOT NULL,
  document_type ENUM('DNI','LICENSE','ART','PSYCHOPHYSICAL') NOT NULL,
  expiry_date   DATE         NOT NULL COMMENT 'alert 2 weeks before expiry (RN-17)',
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(50)  NOT NULL COMMENT 'PDF/JPG/PNG (validated in app)',
  file_size     INT UNSIGNED NOT NULL,
  uploaded_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL COMMENT 'soft delete',
  PRIMARY KEY (id),
  KEY idx_driver_documents_driver (driver_id),
  KEY idx_driver_documents_expiry (expiry_date),
  CONSTRAINT fk_driver_documents_driver FOREIGN KEY (driver_id)
    REFERENCES drivers (user_id) ON DELETE RESTRICT,
  CONSTRAINT chk_driver_documents_size CHECK (file_size <= 1048576)  -- F-9: 1 MB
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. vehicles — fleet (C-1, A-13, P-A)
-- ----------------------------------------------------------------------------
CREATE TABLE vehicles (
  id                    INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  license_plate         VARCHAR(10)       NOT NULL,
  model                 VARCHAR(100)      NOT NULL,
  year                  SMALLINT UNSIGNED NOT NULL,
  initial_km            INT UNSIGNED      NOT NULL COMMENT 'manual entry on creation (A-13)',
  accumulated_km        INT UNSIGNED      NOT NULL,
  last_maintenance_date DATE              NULL,
  insurance_expiry_date DATE              NULL COMMENT 'P-A: required by INSURANCE_EXPIRED alert (C-4)',
  status                ENUM('AVAILABLE','INACTIVE','IN_WORKSHOP','ON_TRIP') NOT NULL DEFAULT 'AVAILABLE',
  deleted_at            DATETIME          NULL COMMENT 'soft delete (RN-20)',
  created_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_plate (license_plate),
  KEY idx_vehicles_status (status),
  KEY idx_vehicles_insurance_expiry (insurance_expiry_date),
  CONSTRAINT chk_vehicles_km CHECK (accumulated_km >= initial_km)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. maintenance_types — catalog (C-7, RN-13, P-B)
-- ----------------------------------------------------------------------------
CREATE TABLE maintenance_types (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name            VARCHAR(50)      NOT NULL,
  description     VARCHAR(255)     NOT NULL,
  km_alert        INT UNSIGNED     NOT NULL,
  km_target       INT UNSIGNED     NOT NULL,
  months_alert    TINYINT UNSIGNED NULL COMMENT 'P-B: time-based threshold from C-7',
  months_target   TINYINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_maintenance_types_name (name),
  CONSTRAINT chk_maintenance_types_km     CHECK (km_target >= km_alert),
  CONSTRAINT chk_maintenance_types_months CHECK (months_target IS NULL OR months_alert IS NULL
                                                 OR months_target >= months_alert)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. maintenances — interventions (C-6)
-- ----------------------------------------------------------------------------
CREATE TABLE maintenances (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  vehicle_id          INT UNSIGNED NOT NULL,
  maintenance_type_id INT UNSIGNED NOT NULL,
  status              ENUM('PENDING','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'PENDING',
  scheduled_at        DATETIME     NOT NULL,
  completed_at        DATETIME     NULL,
  km                  INT UNSIGNED NOT NULL COMMENT 'vehicle km at registration',
  notes               TEXT         NULL,
  next_maintenance_km INT UNSIGNED NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_maintenances_vehicle_status (vehicle_id, status),
  KEY idx_maintenances_status (status),
  KEY idx_maintenances_scheduled (scheduled_at),
  CONSTRAINT fk_maintenances_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_maintenances_type FOREIGN KEY (maintenance_type_id)
    REFERENCES maintenance_types (id) ON DELETE RESTRICT,
  CONSTRAINT chk_maintenances_completed
    CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. maintenance_attachments — receipts 1:N (P-D, F-9)
-- ----------------------------------------------------------------------------
CREATE TABLE maintenance_attachments (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  maintenance_id INT UNSIGNED NOT NULL,
  file_name      VARCHAR(255) NOT NULL,
  file_path      VARCHAR(500) NOT NULL,
  mime_type      VARCHAR(50)  NOT NULL,
  file_size      INT UNSIGNED NOT NULL,
  uploaded_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_maintenance_attachments_maintenance (maintenance_id),
  CONSTRAINT fk_maintenance_attachments_maintenance FOREIGN KEY (maintenance_id)
    REFERENCES maintenances (id) ON DELETE CASCADE,
  CONSTRAINT chk_maintenance_attachments_size CHECK (file_size <= 1048576)  -- F-9: 1 MB
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. trips — core business entity (A-1, A-2, RN-5, RN-14, RN-21)
-- ----------------------------------------------------------------------------
CREATE TABLE trips (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  origin              VARCHAR(120)  NOT NULL
    DEFAULT 'Ciudad Industria, Autopista Córdoba - Rosario, Rosario, Santa Fe' COMMENT 'RN-21: fixed origin',
  destination         VARCHAR(120)  NOT NULL,
  departure_at        DATETIME      NOT NULL,
  status              ENUM('PENDING_ASSIGNMENT','IN_PROGRESS','COMPLETED')
                                    NOT NULL DEFAULT 'PENDING_ASSIGNMENT' COMMENT 'no CANCELLED status (RN-14)',
  estimated_distance_km DECIMAL(8,2) NULL,
  estimated_time_min  INT UNSIGNED  NULL,
  notes               TEXT          NULL,
  operator_id         INT UNSIGNED  NOT NULL,
  driver_id           INT UNSIGNED  NULL COMMENT 'NULL until assignment (A-1)',
  vehicle_id          INT UNSIGNED  NULL COMMENT 'automatic assignment (RN-12)',
  departure_km        INT UNSIGNED  NULL COMMENT 'vehicle km snapshot at assignment',
  arrival_km          INT UNSIGNED  NULL,
  assigned_at         DATETIME      NULL,
  finished_at         DATETIME      NULL,
  finished_by_id      INT UNSIGNED  NULL COMMENT 'driver or operator, identical effect (A-3)',
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_trips_status (status),
  KEY idx_trips_departure (departure_at),
  KEY idx_trips_driver_status (driver_id, status),
  KEY idx_trips_vehicle_status (vehicle_id, status),
  KEY idx_trips_operator (operator_id),
  CONSTRAINT fk_trips_operator FOREIGN KEY (operator_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_driver FOREIGN KEY (driver_id)
    REFERENCES drivers (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_finished_by FOREIGN KEY (finished_by_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  -- RN-5: arrival km strictly greater than departure km
  CONSTRAINT chk_trips_km CHECK (arrival_km IS NULL OR arrival_km > departure_km),
  -- Status ↔ data consistency (A-1/A-2)
  CONSTRAINT chk_trips_assigned CHECK (
    status = 'PENDING_ASSIGNMENT'
    OR (driver_id IS NOT NULL AND vehicle_id IS NOT NULL
        AND departure_km IS NOT NULL AND assigned_at IS NOT NULL)
  ),
  CONSTRAINT chk_trips_completed CHECK (
    status <> 'COMPLETED'
    OR (arrival_km IS NOT NULL AND finished_at IS NOT NULL
        AND finished_by_id IS NOT NULL)
  )
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 10. alerts — polymorphic reference, extensible taxonomy (C-4, A-12)
-- ----------------------------------------------------------------------------
CREATE TABLE alerts (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  alert_type     VARCHAR(50)  NOT NULL COMMENT 'extensible VARCHAR (C-4): LICENSE_EXPIRING, LICENSE_EXPIRED, DOCUMENT_EXPIRING, DOCUMENT_EXPIRED, MAINTENANCE_PENDING, MAINTENANCE_KM_EXCEEDED, INSURANCE_EXPIRED, VEHICLE_INACTIVE',
  description    VARCHAR(255) NOT NULL,
  entity_type    VARCHAR(30)  NOT NULL COMMENT 'DRIVER | VEHICLE | DRIVER_DOCUMENT | MAINTENANCE',
  entity_id      INT UNSIGNED NOT NULL,
  raised_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status         ENUM('PENDING','RESOLVED') NOT NULL DEFAULT 'PENDING',
  resolved_by_id INT UNSIGNED NULL,
  resolved_at    DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_alerts_status_raised (status, raised_at),
  KEY idx_alerts_entity (entity_type, entity_id),
  CONSTRAINT fk_alerts_resolved_by FOREIGN KEY (resolved_by_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_alerts_resolved
    CHECK (status <> 'RESOLVED' OR (resolved_by_id IS NOT NULL AND resolved_at IS NOT NULL))
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 11. audit_logs — INSERT/SELECT only from the app (RN-7, A-5)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED    NOT NULL,
  action        VARCHAR(30)     NOT NULL COMMENT 'CREATE|UPDATE|DELETE|ASSIGN|FINISH|ACTIVATE|DEACTIVATE|...',
  entity        VARCHAR(30)     NOT NULL,
  entity_id     INT UNSIGNED    NULL,
  occurred_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'ms precision: orders events within one transaction',
  previous_data JSON            NULL,
  new_data      JSON            NULL,
  PRIMARY KEY (id),
  KEY idx_audit_logs_user_date (user_id, occurred_at),
  KEY idx_audit_logs_entity (entity, entity_id),
  KEY idx_audit_logs_date (occurred_at),
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. company_settings — single row
-- ----------------------------------------------------------------------------
CREATE TABLE company_settings (
  id           TINYINT UNSIGNED NOT NULL DEFAULT 1,
  company_name VARCHAR(150)     NOT NULL,
  tax_id       VARCHAR(13)      NOT NULL COMMENT 'CUIT',
  address      VARCHAR(200)     NOT NULL,
  phone        VARCHAR(30)      NOT NULL,
  email        VARCHAR(150)     NOT NULL,
  timezone     VARCHAR(50)      NOT NULL DEFAULT 'America/Argentina/Cordoba',
  language     VARCHAR(10)      NOT NULL DEFAULT 'es-AR',
  date_format  VARCHAR(20)      NOT NULL DEFAULT 'DD/MM/YYYY',
  updated_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_company_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB;

-- ============================================================================
-- MINIMAL CATALOG SEEDS (full F-1 seeds live in prisma/seed.ts)
-- ============================================================================

INSERT INTO maintenance_types
  (name, description, km_alert, km_target, months_alert, months_target)
VALUES
  ('Preventivo menor', 'Cambio de aceite, filtros y engrase',          10000,  20000,  3,  6),
  ('Preventivo mayor', 'Revisión de frenos, suspensión y alineación',  80000, 120000, 12, 12);

INSERT INTO company_settings (id, company_name, tax_id, address, phone, email)
VALUES (1, 'Empresa de Servicios Logísticos', '30-00000000-0',
        'Ciudad Industria, Rosario, Santa Fe', '+54 341 000-0000',
        'contacto@empresa.com');
