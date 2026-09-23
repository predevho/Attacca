-- 게시글 첨부 파일 수명과 도메인 연결 관계를 도입한다.
-- 기존 file_metadata는 프로필/포스터처럼 이미 사용 중이므로 ATTACHED로 보존한다.
ALTER TABLE file_metadata
    ADD COLUMN state VARCHAR(20) NOT NULL DEFAULT 'ATTACHED';

CREATE TABLE feed_post_attachment (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) DEFAULT NULL,
    updated_at DATETIME(6) DEFAULT NULL,
    post_id BIGINT NOT NULL,
    file_metadata_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_feed_post_attachment_file (file_metadata_id),
    UNIQUE KEY uk_feed_post_attachment_order (post_id, display_order),
    KEY idx_feed_post_attachment_post (post_id, display_order),
    CONSTRAINT fk_feed_post_attachment_post
        FOREIGN KEY (post_id) REFERENCES feed_post (id),
    CONSTRAINT fk_feed_post_attachment_file
        FOREIGN KEY (file_metadata_id) REFERENCES file_metadata (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recruitment_posting_attachment (
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) DEFAULT NULL,
    updated_at DATETIME(6) DEFAULT NULL,
    posting_id BIGINT NOT NULL,
    file_metadata_id BIGINT NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_recruitment_posting_attachment_file (file_metadata_id),
    UNIQUE KEY uk_recruitment_posting_attachment_order (posting_id, display_order),
    KEY idx_recruitment_posting_attachment_posting (posting_id, display_order),
    CONSTRAINT fk_recruitment_posting_attachment_posting
        FOREIGN KEY (posting_id) REFERENCES recruitment_posting (id),
    CONSTRAINT fk_recruitment_posting_attachment_file
        FOREIGN KEY (file_metadata_id) REFERENCES file_metadata (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
