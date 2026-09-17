ALTER TABLE `notice`
  ADD COLUMN `source_name` varchar(200) DEFAULT NULL,
  ADD COLUMN `source_url` varchar(500) DEFAULT NULL;

CREATE TABLE `imported_item` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `source` varchar(20) NOT NULL,
  `source_key` varchar(200) NOT NULL,
  `source_name` varchar(200) NOT NULL,
  `source_url` varchar(500) DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `starts_at` date DEFAULT NULL,
  `ends_at` date DEFAULT NULL,
  `posted_at` date DEFAULT NULL,
  `place` varchar(200) DEFAULT NULL,
  `summary` varchar(2000) DEFAULT NULL,
  `poster_url` varchar(500) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `notice_id` bigint DEFAULT NULL,
  `last_seen_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_imported_item_source_key` (`source`,`source_key`),
  KEY `idx_imported_item_status_created` (`status`,`created_at`,`id`),
  KEY `idx_imported_item_source_created` (`source`,`created_at`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `import_run` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `source` varchar(20) NOT NULL,
  `trigger` varchar(20) NOT NULL,
  `started_at` datetime(6) NOT NULL,
  `finished_at` datetime(6) NOT NULL,
  `result` varchar(20) NOT NULL,
  `new_count` int NOT NULL,
  `message` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_import_run_source_started` (`source`,`started_at`,`id`),
  KEY `idx_import_run_finished_at` (`finished_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
