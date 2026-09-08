package com.back.domain.notice.repository;

import com.back.domain.notice.entity.Notice;
import com.back.domain.notice.entity.NoticeType;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    Optional<Notice> findByIdAndDeletedAtIsNull(Long id);

    /** 홈 캐러셀: 고정된 것만, 최신순. */
    Page<Notice> findByDeletedAtIsNullAndPinnedTrueOrderByCreatedAtDesc(Pageable pageable);

    /**
     * 홈 달력: scheduledAt이 [from, to) 범위, 이른 순.
     * 경계는 from 포함 / to 미포함 — 월 단위 조회에서 다음 달 1일 0시를 to로 넘기면 그 달만 정확히 잡힌다.
     */
    Page<Notice> findByDeletedAtIsNullAndScheduledAtGreaterThanEqualAndScheduledAtLessThanOrderByScheduledAtAsc(
            LocalDateTime from, LocalDateTime to, Pageable pageable);

    /** 전체(미삭제): 최신순. */
    Page<Notice> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    /** 어드민 목록의 종류 필터: 최신순. */
    Page<Notice> findByDeletedAtIsNullAndTypeOrderByCreatedAtDesc(NoticeType type, Pageable pageable);
}
