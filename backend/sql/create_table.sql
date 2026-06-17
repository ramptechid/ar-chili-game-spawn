-- LANGKAH:
-- 1. Buat database dulu di cPanel → MySQL Databases
-- 2. Pilih database itu di phpMyAdmin (klik namanya di sidebar kiri)
-- 3. Baru jalankan SQL di bawah ini

CREATE TABLE IF NOT EXISTS `scores` (
  `id`          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `player_name` VARCHAR(100)      NOT NULL,
  `instagram`   VARCHAR(30)       NOT NULL DEFAULT '',
  `score`       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_score` (`score` DESC, `created_at` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
