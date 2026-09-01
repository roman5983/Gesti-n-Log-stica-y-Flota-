-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(60) NOT NULL,
    `role` ENUM('ADMIN', 'OPERATOR', 'DRIVER') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_users_email`(`email`),
    INDEX `idx_users_role_active`(`role`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_refresh_tokens_hash`(`token_hash`),
    INDEX `idx_refresh_tokens_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drivers` (
    `user_id` INTEGER UNSIGNED NOT NULL,
    `dni` VARCHAR(10) NOT NULL,
    `license_category` ENUM('A', 'B', 'C', 'E') NOT NULL,
    `license_expiry_date` DATE NOT NULL,
    `encrypted_password` VARCHAR(255) NOT NULL,
    `completed_trips` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `avg_km` DECIMAL(10, 2) NOT NULL DEFAULT 0,

    UNIQUE INDEX `uq_drivers_dni`(`dni`),
    INDEX `idx_drivers_license_expiry`(`license_expiry_date`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `driver_documents` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `driver_id` INTEGER UNSIGNED NOT NULL,
    `document_type` ENUM('DNI', 'LICENSE', 'ART', 'PSYCHOPHYSICAL') NOT NULL,
    `expiry_date` DATE NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(50) NOT NULL,
    `file_size` INTEGER UNSIGNED NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_driver_documents_driver`(`driver_id`),
    INDEX `idx_driver_documents_expiry`(`expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicles` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `license_plate` VARCHAR(10) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `year` SMALLINT UNSIGNED NOT NULL,
    `initial_km` INTEGER UNSIGNED NOT NULL,
    `accumulated_km` INTEGER UNSIGNED NOT NULL,
    `last_maintenance_date` DATE NULL,
    `insurance_expiry_date` DATE NULL,
    `status` ENUM('AVAILABLE', 'INACTIVE', 'IN_WORKSHOP', 'ON_TRIP') NOT NULL DEFAULT 'AVAILABLE',
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_vehicles_plate`(`license_plate`),
    INDEX `idx_vehicles_status`(`status`),
    INDEX `idx_vehicles_insurance_expiry`(`insurance_expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `km_alert` INTEGER UNSIGNED NOT NULL,
    `km_target` INTEGER UNSIGNED NOT NULL,
    `months_alert` TINYINT UNSIGNED NULL,
    `months_target` TINYINT UNSIGNED NULL,

    UNIQUE INDEX `uq_maintenance_types_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenances` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `vehicle_id` INTEGER UNSIGNED NOT NULL,
    `maintenance_type_id` INTEGER UNSIGNED NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `scheduled_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,
    `km` INTEGER UNSIGNED NOT NULL,
    `notes` TEXT NULL,
    `next_maintenance_km` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_maintenances_vehicle_status`(`vehicle_id`, `status`),
    INDEX `idx_maintenances_status`(`status`),
    INDEX `idx_maintenances_scheduled`(`scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_attachments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `maintenance_id` INTEGER UNSIGNED NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(50) NOT NULL,
    `file_size` INTEGER UNSIGNED NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_maintenance_attachments_maintenance`(`maintenance_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trips` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `origin` VARCHAR(120) NOT NULL DEFAULT 'Ciudad Industria, Autopista Córdoba - Rosario, Rosario, Santa Fe',
    `destination` VARCHAR(120) NOT NULL,
    `departure_at` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING_ASSIGNMENT', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    `estimated_distance_km` DECIMAL(8, 2) NULL,
    `estimated_time_min` INTEGER UNSIGNED NULL,
    `notes` TEXT NULL,
    `operator_id` INTEGER UNSIGNED NOT NULL,
    `driver_id` INTEGER UNSIGNED NULL,
    `vehicle_id` INTEGER UNSIGNED NULL,
    `departure_km` INTEGER UNSIGNED NULL,
    `arrival_km` INTEGER UNSIGNED NULL,
    `assigned_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `finished_by_id` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_trips_status`(`status`),
    INDEX `idx_trips_departure`(`departure_at`),
    INDEX `idx_trips_driver_status`(`driver_id`, `status`),
    INDEX `idx_trips_vehicle_status`(`vehicle_id`, `status`),
    INDEX `idx_trips_operator`(`operator_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerts` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `alert_type` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `entity_type` VARCHAR(30) NOT NULL,
    `entity_id` INTEGER UNSIGNED NOT NULL,
    `raised_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    `resolved_by_id` INTEGER UNSIGNED NULL,
    `resolved_at` DATETIME(3) NULL,

    INDEX `idx_alerts_status_raised`(`status`, `raised_at`),
    INDEX `idx_alerts_entity`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `action` VARCHAR(30) NOT NULL,
    `entity` VARCHAR(30) NOT NULL,
    `entity_id` INTEGER UNSIGNED NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `previous_data` JSON NULL,
    `new_data` JSON NULL,

    INDEX `idx_audit_logs_user_date`(`user_id`, `occurred_at`),
    INDEX `idx_audit_logs_entity`(`entity`, `entity_id`),
    INDEX `idx_audit_logs_date`(`occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_settings` (
    `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `company_name` VARCHAR(150) NOT NULL,
    `tax_id` VARCHAR(13) NOT NULL,
    `address` VARCHAR(200) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'America/Argentina/Cordoba',
    `language` VARCHAR(10) NOT NULL DEFAULT 'es-AR',
    `date_format` VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drivers` ADD CONSTRAINT `fk_drivers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `driver_documents` ADD CONSTRAINT `fk_driver_documents_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenances` ADD CONSTRAINT `fk_maintenances_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenances` ADD CONSTRAINT `fk_maintenances_type` FOREIGN KEY (`maintenance_type_id`) REFERENCES `maintenance_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_attachments` ADD CONSTRAINT `fk_maintenance_attachments_maintenance` FOREIGN KEY (`maintenance_id`) REFERENCES `maintenances`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `fk_trips_operator` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `fk_trips_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `fk_trips_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trips` ADD CONSTRAINT `fk_trips_finished_by` FOREIGN KEY (`finished_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `fk_alerts_resolved_by` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
