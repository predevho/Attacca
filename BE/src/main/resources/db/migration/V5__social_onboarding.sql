-- 기존 회원은 이미 서비스 이용 중이므로 완료 상태로 보존한다.
ALTER TABLE `member`
    ADD COLUMN `onboarding_complete` bit(1) NOT NULL DEFAULT b'1';
