-- 회원 탈퇴 (DOMAIN-MEMBER-STATUTE §3.5)
--
-- 사람은 지우고 글은 남긴다. 작성물까지 지우면 남의 글타래가 무너지므로,
-- member 행 자체는 남기고 개인 식별 정보만 비우거나 익명 값으로 바꾼다.
-- deleted_at 이 채워지면 로그인·재발급이 막힌다.
ALTER TABLE `member` ADD COLUMN `deleted_at` datetime(6) DEFAULT NULL;
