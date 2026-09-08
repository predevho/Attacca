-- 동의 이력 (DOMAIN-MEMBER-STATUTE §3.4)
--
-- 최신 1건이 아니라 이력 전부를 남긴다. 약관이 바뀌어 다시 동의를 받으면 행이 하나 더 쌓인다.
-- 회원 FK를 걸지 않는다 — 탈퇴해도 동의 사실은 남아야 하고, 이 표에는 개인 식별 정보가
-- 없다(회원 id와 동의 사실뿐). FK가 있으면 회원을 지울 때 같이 지우고 싶은 유혹이 생긴다.
CREATE TABLE `member_consent` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `member_id` bigint NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agreed_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_member_consent_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
