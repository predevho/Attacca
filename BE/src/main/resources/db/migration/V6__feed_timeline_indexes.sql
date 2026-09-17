-- 피드 첫 페이지는 미삭제 최신글 + 게시글별 좋아요/댓글 집계를 함께 조회한다.
-- 기존 유니크 키(member_id, post_id)는 내 좋아요 조회에는 맞지만 post_id 집계에는 맞지 않는다.
CREATE INDEX `idx_feed_post_timeline` ON `feed_post` (`deleted_at`, `id`);
CREATE INDEX `idx_feed_post_like_post` ON `feed_post_like` (`post_id`);
CREATE INDEX `idx_feed_comment_post_deleted` ON `feed_comment` (`post_id`, `deleted_at`);
