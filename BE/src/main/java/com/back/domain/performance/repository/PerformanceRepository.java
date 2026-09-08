package com.back.domain.performance.repository;

import com.back.domain.performance.entity.Performance;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerformanceRepository extends JpaRepository<Performance, Long> {

    Optional<Performance> findByIdAndDeletedAtIsNull(Long id);

    /** 다가오는 공연: 지금 이후, 가까운 순. */
    Page<Performance> findByDeletedAtIsNullAndPerformedAtGreaterThanEqualOrderByPerformedAtAsc(
            LocalDateTime now, Pageable pageable);

    /** 지난 공연: 지금 이전, 최근 순. */
    Page<Performance> findByDeletedAtIsNullAndPerformedAtLessThanOrderByPerformedAtDesc(
            LocalDateTime now, Pageable pageable);

    /** 전체(미삭제): 공연일 최신 순. */
    Page<Performance> findByDeletedAtIsNullOrderByPerformedAtDesc(Pageable pageable);

    /**
     * 홈 달력용: performedAt이 [from, to) 범위, 이른 순.
     * 경계는 from 포함 / to 미포함 — NOTICE의 일정 범위 조회와 같은 규약이다.
     */
    Page<Performance> findByDeletedAtIsNullAndPerformedAtGreaterThanEqualAndPerformedAtLessThanOrderByPerformedAtAsc(
            LocalDateTime from, LocalDateTime to, Pageable pageable);
}
