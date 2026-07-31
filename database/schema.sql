-- ============================================================
-- SAN Orders Admin – MySQL Database Schema
-- Local DB stores: users, phases, permissions, activity, settings
-- Orders are NOT stored here (fetched from third-party APIs)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `san_orders_admin`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `san_orders_admin`;

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `email_verified_at` TIMESTAMP NULL DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('super_admin', 'staff') NOT NULL DEFAULT 'staff',
  `job_title` VARCHAR(255) NULL DEFAULT NULL,
  `phone` VARCHAR(50) NULL DEFAULT NULL,
  `avatar_initials` VARCHAR(10) NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `remember_token` VARCHAR(100) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_index` (`role`),
  KEY `users_is_active_index` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Order processing phases (7 main phases)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_phases` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL DEFAULT NULL,
  `sort_order` TINYINT UNSIGNED NOT NULL,
  `color` VARCHAR(30) NULL DEFAULT NULL,
  `icon` VARCHAR(50) NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_phases_code_unique` (`code`),
  KEY `order_phases_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- User ↔ Phase assignments (staff can have one or many phases)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_phases` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `phase_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_phases_user_phase_unique` (`user_id`, `phase_id`),
  KEY `user_phases_phase_id_foreign` (`phase_id`),
  CONSTRAINT `user_phases_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_phases_phase_id_foreign`
    FOREIGN KEY (`phase_id`) REFERENCES `order_phases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Staff activity / audit log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `order_reference` VARCHAR(100) NOT NULL,
  `phase_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `phase_code` VARCHAR(50) NULL DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `previous_status` VARCHAR(100) NULL DEFAULT NULL,
  `updated_status` VARCHAR(100) NULL DEFAULT NULL,
  `details` JSON NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `activity_logs_user_id_index` (`user_id`),
  KEY `activity_logs_order_reference_index` (`order_reference`),
  KEY `activity_logs_phase_id_index` (`phase_id`),
  KEY `activity_logs_created_at_index` (`created_at`),
  CONSTRAINT `activity_logs_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `activity_logs_phase_id_foreign`
    FOREIGN KEY (`phase_id`) REFERENCES `order_phases` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Application settings (API URLs, credentials, flags)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `settings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT NULL DEFAULT NULL,
  `type` VARCHAR(30) NOT NULL DEFAULT 'string',
  `group` VARCHAR(50) NOT NULL DEFAULT 'general',
  `label` VARCHAR(255) NULL DEFAULT NULL,
  `is_encrypted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_unique` (`key`),
  KEY `settings_group_index` (`group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Laravel / Sanctum support tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(255) NOT NULL,
  `tokenable_id` BIGINT UNSIGNED NOT NULL,
  `name` TEXT NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `abilities` TEXT NULL DEFAULT NULL,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `expires_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_index` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(255) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `ip_address` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` TEXT NULL DEFAULT NULL,
  `payload` LONGTEXT NOT NULL,
  `last_activity` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cache` (
  `key` VARCHAR(255) NOT NULL,
  `value` MEDIUMTEXT NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` VARCHAR(255) NOT NULL,
  `owner` VARCHAR(255) NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `queue` VARCHAR(255) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `attempts` TINYINT UNSIGNED NOT NULL,
  `reserved_at` INT UNSIGNED NULL DEFAULT NULL,
  `available_at` INT UNSIGNED NOT NULL,
  `created_at` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `total_jobs` INT NOT NULL,
  `pending_jobs` INT NOT NULL,
  `failed_jobs` INT NOT NULL,
  `failed_job_ids` LONGTEXT NOT NULL,
  `options` MEDIUMTEXT NULL DEFAULT NULL,
  `cancelled_at` INT NULL DEFAULT NULL,
  `created_at` INT NOT NULL,
  `finished_at` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(255) NOT NULL,
  `connection` TEXT NOT NULL,
  `queue` TEXT NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `exception` LONGTEXT NOT NULL,
  `failed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255) NOT NULL,
  `batch` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Seed: 7 order phases
-- ------------------------------------------------------------
INSERT INTO `order_phases` (`code`, `name`, `description`, `sort_order`, `color`, `icon`, `is_active`, `created_at`, `updated_at`) VALUES
('received', 'Received', 'Order received in the system', 1, 'blue', 'clipboard-list', 1, NOW(), NOW()),
('ready_to_pick', 'Ready to Pick', 'Order is verified and ready for picking', 2, 'green', 'shopping-cart', 1, NOW(), NOW()),
('picked_packed', 'Picked & Packed', 'Items picked and packed', 3, 'green', 'package', 1, NOW(), NOW()),
('shipping_preparation', 'Shipping Preparation', 'Order is weighed and prepared for shipping (label & carrier)', 4, 'purple', 'scale', 1, NOW(), NOW()),
('invoiced', 'Invoiced', 'Invoice has been created for the order', 5, 'orange', 'file-text', 1, NOW(), NOW()),
('shipped', 'Shipped', 'Order picked up by carrier / shipped to customer', 6, 'blue', 'truck', 1, NOW(), NOW()),
('completed', 'Completed', 'Order is successfully delivered and closed', 7, 'green', 'check-circle', 1, NOW(), NOW());

-- ------------------------------------------------------------
-- Seed: Super Admin
-- Prefer Laravel seeder for correct bcrypt hash:
--   php artisan db:seed
--   email: sanmehmi@gmail.com
--   password: sanmehmi
-- ------------------------------------------------------------
-- (User insert is handled by Laravel DatabaseSeeder)

-- ------------------------------------------------------------
-- Seed: default application settings (third-party API placeholders)
-- ------------------------------------------------------------
INSERT INTO `settings` (`key`, `value`, `type`, `group`, `label`, `is_encrypted`, `created_at`, `updated_at`) VALUES
('erp_api_base_url', '', 'string', 'api', 'ERP API Base URL', 0, NOW(), NOW()),
('erp_api_key', '', 'string', 'api', 'ERP API Key', 1, NOW(), NOW()),
('erp_orders_list_path', '/orders', 'string', 'api', 'Orders Listing Path', 0, NOW(), NOW()),
('erp_order_details_path', '/orders/{id}', 'string', 'api', 'Order Details Path', 0, NOW(), NOW()),
('erp_order_status_path', '/orders/{id}/status', 'string', 'api', 'Order Status Path', 0, NOW(), NOW()),
('erp_order_update_path', '/orders/{id}', 'string', 'api', 'Order Update Path', 0, NOW(), NOW()),
('use_mock_orders', '1', 'boolean', 'api', 'Use Mock Order Data', 0, NOW(), NOW()),
('app_name', 'SAN Orders Admin', 'string', 'general', 'Application Name', 0, NOW(), NOW());
