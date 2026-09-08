-- Attacca 초기 스키마 (베이스라인)
--
-- 이 파일은 2026-09-08까지 `ddl-auto: update`로 만들어진 스키마를 그대로 추출한 것이다.
-- 이후 스키마 변경은 Hibernate가 아니라 이 디렉터리의 마이그레이션으로만 한다
-- (운영 DB에서 Hibernate가 자기 판단으로 스키마를 바꾸는 것을 막기 위함. `ddl-auto`는 validate).
--
-- 이미 테이블이 있는 기존 DB는 spring.flyway.baseline-on-migrate=true 로 이 버전을
-- "적용된 것으로" 표시하고 넘어간다. 새 DB에서는 이 스크립트가 실제로 실행된다.

CREATE TABLE `chat_message` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `content` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `room_id` bigint NOT NULL,
  `sender_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_chat_message_room` (`room_id`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `chat_participant` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `last_read_message_id` bigint DEFAULT NULL,
  `left_at` datetime(6) DEFAULT NULL,
  `member_id` bigint NOT NULL,
  `room_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKkclhu3m3b5g3l4oyo0xlr58f6` (`room_id`,`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `chat_room` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `created_by` bigint NOT NULL,
  `direct_key` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_message_at` datetime(6) NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('DIRECT','GROUP') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK72fwki87e2scid4pp78cetqe0` (`direct_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `feed_comment` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `author_id` bigint NOT NULL,
  `content` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `post_id` bigint NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `feed_comment_like` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `comment_id` bigint NOT NULL,
  `member_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKt5n96h1wyswkxbdy0rw1kw6bx` (`member_id`,`comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `feed_post` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `author_id` bigint NOT NULL,
  `content` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `feed_post_like` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint NOT NULL,
  `post_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKpesg19x1ge3bychlxtowcbhr3` (`member_id`,`post_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `file_metadata` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `content_type` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` bigint NOT NULL,
  `storage_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploader_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK9dyihdja5sr0lm43v09dsnlyh` (`storage_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `member` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('ADMIN','USER') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKmbmcqelty0fbrvxp1q58dn57t` (`email`),
  UNIQUE KEY `UKhh9kg6jti4n1eoiertn2k6qsc` (`nickname`),
  UNIQUE KEY `UKenfm5patwjqulw8k4wwuo6f60` (`login_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `member_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `bio` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_image_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKc87j55l2co10d3t5m5xmbutu1` (`member_id`),
  CONSTRAINT `FKkrtcs7wdtv954e99w88uga9mq` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `member_profile_instrument` (
  `member_profile_id` bigint NOT NULL,
  `instrument` enum('BASSOON','CELLO','CLARINET','COMPOSITION','CONDUCTING','DOUBLE_BASS','ETC','FLUTE','HARP','HORN','OBOE','ORGAN','PERCUSSION','PIANO','TROMBONE','TRUMPET','TUBA','VIOLA','VIOLIN','VOCAL','VOICE') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`member_profile_id`,`instrument`),
  CONSTRAINT `FKp8oyg83l526obwerbloqvcj4i` FOREIGN KEY (`member_profile_id`) REFERENCES `member_profile` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `notice` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `author_id` bigint NOT NULL,
  `content` varchar(5000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cover_image_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `pinned` bit(1) NOT NULL,
  `place` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_at` datetime(6) DEFAULT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('EVENT','NEWS','NOTICE') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notice_scheduled` (`deleted_at`,`scheduled_at`),
  KEY `idx_notice_pinned` (`deleted_at`,`pinned`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `performance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `description` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organizer_id` bigint NOT NULL,
  `performed_at` datetime(6) NOT NULL,
  `poster_image_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `program` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticket_info` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticket_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `venue` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `recruitment_application` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `applicant_id` bigint NOT NULL,
  `message` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `posting_id` bigint NOT NULL,
  `status` enum('ACCEPTED','PENDING','REJECTED','WITHDRAWN') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `recruitment_posting` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `author_id` bigint NOT NULL,
  `deadline` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `description` varchar(2000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fee` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recruit_count` int DEFAULT NULL,
  `status` enum('CLOSED','OPEN') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `recruitment_posting_instrument` (
  `posting_id` bigint NOT NULL,
  `instrument` enum('BASSOON','CELLO','CLARINET','COMPOSITION','CONDUCTING','DOUBLE_BASS','ETC','FLUTE','HARP','HORN','OBOE','ORGAN','PERCUSSION','PIANO','TROMBONE','TRUMPET','TUBA','VIOLA','VIOLIN','VOCAL','VOICE') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  KEY `FKiyq708sp6cmlyeesyc8kq90ln` (`posting_id`),
  CONSTRAINT `FKiyq708sp6cmlyeesyc8kq90ln` FOREIGN KEY (`posting_id`) REFERENCES `recruitment_posting` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `social_account` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `provider` enum('KAKAO') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKs9tx0ab77isnfu6p5hdb8m9i5` (`provider`,`provider_user_id`),
  KEY `FK2bhcb0uq2buq7m4c6ogvo1fx8` (`member_id`),
  CONSTRAINT `FK2bhcb0uq2buq7m4c6ogvo1fx8` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `verification_application` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `decided_at` datetime(6) DEFAULT NULL,
  `decided_by` bigint DEFAULT NULL,
  `decision_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_id` bigint NOT NULL,
  `statement` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('APPROVED','PENDING','REJECTED','REVOKED') COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `verification_application_evidence` (
  `application_id` bigint NOT NULL,
  `evidence_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  KEY `FKdftfxbpvrtu3d7hv8b2g4h3ny` (`application_id`),
  CONSTRAINT `FKdftfxbpvrtu3d7hv8b2g4h3ny` FOREIGN KEY (`application_id`) REFERENCES `verification_application` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


