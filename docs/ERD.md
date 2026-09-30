# Attacca ERD

## 기준

- 기준 스키마: `BE/src/main/resources/db/migration/`
- 현재 Flyway 마이그레이션: `V1`부터 `V9`
- 총 테이블: **24개**
- 모든 주요 엔티티의 `created_at`, `updated_at`은 가독성을 위해 다이어그램에서 생략했다.
- `--` 관계는 Flyway에 명시된 물리 FK, `..` 관계는 컬럼명과 도메인 코드로 확인되는 논리 관계다.
- `import_run`, `imported_item`은 외부 반입 기능을 폐기한 뒤에도 기존 운영 데이터 보존을 위해 남겨 둔 역사 테이블이다. 현재 애플리케이션 런타임은 이 테이블을 사용하지 않는다.

## 전체 ERD

```mermaid
erDiagram
    MEMBER {
        bigint id PK
        varchar email UK
        varchar login_id UK
        varchar nickname UK
        enum role
        datetime deleted_at
        boolean onboarding_complete
    }

    MEMBER_PROFILE {
        bigint id PK
        bigint member_id FK UK
        varchar bio
        varchar profile_image_key
    }

    MEMBER_PROFILE_INSTRUMENT {
        bigint member_profile_id PK, FK
        enum instrument PK
    }

    MEMBER_CONSENT {
        bigint id PK
        bigint member_id
        varchar type
        varchar version
        datetime agreed_at
    }

    SOCIAL_ACCOUNT {
        bigint id PK
        bigint member_id FK
        enum provider
        varchar provider_user_id
    }

    FEED_POST {
        bigint id PK
        bigint author_id
        varchar content
        datetime deleted_at
    }

    FEED_COMMENT {
        bigint id PK
        bigint post_id
        bigint author_id
        varchar content
        datetime deleted_at
    }

    FEED_POST_LIKE {
        bigint id PK
        bigint post_id
        bigint member_id
    }

    FEED_COMMENT_LIKE {
        bigint id PK
        bigint comment_id
        bigint member_id
    }

    FEED_POST_ATTACHMENT {
        bigint id PK
        bigint post_id FK
        bigint file_metadata_id FK UK
        int display_order
    }

    PERFORMANCE {
        bigint id PK
        bigint organizer_id
        varchar title
        datetime performed_at
        varchar venue
        varchar poster_image_key
        datetime deleted_at
    }

    RECRUITMENT_POSTING {
        bigint id PK
        bigint author_id
        varchar title
        enum status
        datetime deadline
        datetime deleted_at
    }

    RECRUITMENT_POSTING_INSTRUMENT {
        bigint posting_id PK, FK
        enum instrument
    }

    RECRUITMENT_APPLICATION {
        bigint id PK
        bigint posting_id
        bigint applicant_id
        enum status
        varchar message
    }

    RECRUITMENT_POSTING_ATTACHMENT {
        bigint id PK
        bigint posting_id FK
        bigint file_metadata_id FK UK
        int display_order
    }

    CHAT_ROOM {
        bigint id PK
        bigint created_by
        enum type
        varchar direct_key UK
        varchar title
        datetime last_message_at
    }

    CHAT_PARTICIPANT {
        bigint id PK
        bigint room_id
        bigint member_id
        bigint last_read_message_id
        datetime left_at
    }

    CHAT_MESSAGE {
        bigint id PK
        bigint room_id
        bigint sender_id
        varchar content
    }

    NOTICE {
        bigint id PK
        bigint author_id
        enum type
        varchar title
        datetime scheduled_at
        boolean pinned
        varchar cover_image_key
        varchar source_url
        datetime deleted_at
    }

    VERIFICATION_APPLICATION {
        bigint id PK
        bigint member_id
        bigint decided_by
        enum status
        varchar statement
        datetime decided_at
    }

    VERIFICATION_APPLICATION_EVIDENCE {
        bigint application_id FK
        varchar evidence_url
    }

    FILE_METADATA {
        bigint id PK
        bigint uploader_id
        varchar original_name
        varchar content_type
        bigint file_size
        varchar storage_key UK
        enum state
    }

    IMPORTED_ITEM {
        bigint id PK
        varchar source
        varchar source_key UK
        bigint notice_id
        enum status
        datetime last_seen_at
    }

    IMPORT_RUN {
        bigint id PK
        varchar source
        varchar run_trigger
        enum result
        int new_count
        datetime started_at
        datetime finished_at
    }

    MEMBER ||--o| MEMBER_PROFILE : has
    MEMBER_PROFILE ||--o{ MEMBER_PROFILE_INSTRUMENT : selects
    MEMBER ||--o{ SOCIAL_ACCOUNT : connects

    MEMBER ||..o{ MEMBER_CONSENT : records
    MEMBER ||..o{ FEED_POST : writes
    MEMBER ||..o{ FEED_COMMENT : writes
    MEMBER ||..o{ FEED_POST_LIKE : likes
    MEMBER ||..o{ FEED_COMMENT_LIKE : likes
    FEED_POST ||..o{ FEED_COMMENT : contains
    FEED_POST ||..o{ FEED_POST_LIKE : receives
    FEED_COMMENT ||..o{ FEED_COMMENT_LIKE : receives
    FEED_POST ||--o{ FEED_POST_ATTACHMENT : attaches
    FILE_METADATA ||--o| FEED_POST_ATTACHMENT : references

    MEMBER ||..o{ PERFORMANCE : organizes

    MEMBER ||..o{ RECRUITMENT_POSTING : authors
    RECRUITMENT_POSTING ||--o{ RECRUITMENT_POSTING_INSTRUMENT : seeks
    RECRUITMENT_POSTING ||..o{ RECRUITMENT_APPLICATION : receives
    MEMBER ||..o{ RECRUITMENT_APPLICATION : submits
    RECRUITMENT_POSTING ||--o{ RECRUITMENT_POSTING_ATTACHMENT : attaches
    FILE_METADATA ||--o| RECRUITMENT_POSTING_ATTACHMENT : references

    MEMBER ||..o{ CHAT_ROOM : creates
    CHAT_ROOM ||..o{ CHAT_PARTICIPANT : includes
    MEMBER ||..o{ CHAT_PARTICIPANT : joins
    CHAT_ROOM ||..o{ CHAT_MESSAGE : contains
    MEMBER ||..o{ CHAT_MESSAGE : sends

    MEMBER ||..o{ NOTICE : authors
    MEMBER ||..o{ VERIFICATION_APPLICATION : submits
    VERIFICATION_APPLICATION ||--o{ VERIFICATION_APPLICATION_EVIDENCE : includes
    MEMBER ||..o{ FILE_METADATA : uploads

    NOTICE ||..o{ IMPORTED_ITEM : promoted_from
