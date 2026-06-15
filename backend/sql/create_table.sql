-- Jalankan SQL ini di phpMyAdmin setelah membuat database baru.
-- Ganti `chili_game` jika kamu pakai nama database yang berbeda.

CREATE DATABASE IF NOT EXISTS `chili_game`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `chili_game`;

CREATE TABLE IF NOT EXISTS `scores` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `player_name` VARCHAR(100)     NOT NULL,
  `instagram`   VARCHAR(30)      NOT NULL DEFAULT '',
  `score`       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_score` (`score` DESC, `created_at` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
